import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

interface MonitoringStackProps extends cdk.StackProps {
  lambdaFunctions: lambda.Function[];
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(
    scope: Construct,
    id: string,
    config: EnvironmentConfig,
    monitoringProps: MonitoringStackProps,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    const { lambdaFunctions } = monitoringProps;

    // Create SNS topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `${config.stackPrefix}-alarms`,
      displayName: `Readafull ${config.environment} Alarms`,
    });

    // Subscribe email to alarm topic if provided
    if (config.monitoring.alarmEmail) {
      this.alarmTopic.addSubscription(
        new sns_subscriptions.EmailSubscription(config.monitoring.alarmEmail)
      );
    }

    // Create CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${config.stackPrefix}-dashboard`,
    });

    // Set log retention for all Lambda functions
    lambdaFunctions.forEach((fn) => {
      new logs.LogGroup(this, `${fn.node.id}LogGroup`, {
        logGroupName: `/aws/lambda/${fn.functionName}`,
        retention: logs.RetentionDays[`DAYS_${config.monitoring.logRetentionDays}` as keyof typeof logs.RetentionDays] || logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    });

    // Create metrics and alarms for each Lambda function
    const lambdaWidgets: cloudwatch.IWidget[] = [];

    lambdaFunctions.forEach((fn, index) => {
      // Error rate alarm
      const errorMetric = fn.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      const errorAlarm = new cloudwatch.Alarm(this, `${fn.node.id}ErrorAlarm`, {
        alarmName: `${config.stackPrefix}-${fn.functionName}-errors`,
        metric: errorMetric,
        threshold: 10,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Throttle alarm
      const throttleMetric = fn.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      const throttleAlarm = new cloudwatch.Alarm(this, `${fn.node.id}ThrottleAlarm`, {
        alarmName: `${config.stackPrefix}-${fn.functionName}-throttles`,
        metric: throttleMetric,
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      throttleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Duration alarm
      const durationMetric = fn.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      });

      const durationAlarm = new cloudwatch.Alarm(this, `${fn.node.id}DurationAlarm`, {
        alarmName: `${config.stackPrefix}-${fn.functionName}-duration`,
        metric: durationMetric,
        threshold: config.lambda.timeout * 1000 * 0.8, // 80% of timeout in milliseconds
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      durationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Create widget for dashboard
      const widget = new cloudwatch.GraphWidget({
        title: fn.functionName,
        left: [
          fn.metricInvocations({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          errorMetric,
          throttleMetric,
        ],
        right: [durationMetric],
        width: 12,
        height: 6,
      });

      lambdaWidgets.push(widget);
    });

    // Add widgets to dashboard in rows of 2
    for (let i = 0; i < lambdaWidgets.length; i += 2) {
      const row = lambdaWidgets.slice(i, i + 2);
      this.dashboard.addWidgets(...row);
    }

    // Add API Gateway metrics widget
    const apiMetricsWidget = new cloudwatch.GraphWidget({
      title: 'API Gateway Metrics',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Count',
          dimensionsMap: { ApiName: `${config.appName}-api-${config.environment}` },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '4XXError',
          dimensionsMap: { ApiName: `${config.appName}-api-${config.environment}` },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: { ApiName: `${config.appName}-api-${config.environment}` },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
      ],
      right: [
        new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Latency',
          dimensionsMap: { ApiName: `${config.appName}-api-${config.environment}` },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 24,
      height: 6,
    });

    this.dashboard.addWidgets(apiMetricsWidget);

    // Output important values
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for Alarms',
      exportName: `${config.stackPrefix}-AlarmTopicArn`,
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${config.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: `${config.stackPrefix}-DashboardUrl`,
    });
  }
}
