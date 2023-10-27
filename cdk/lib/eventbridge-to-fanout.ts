import type { GuStackProps } from "@guardian/cdk/lib/constructs/core";
import { GuStack } from "@guardian/cdk/lib/constructs/core";
import type { App } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import {SecretValue} from "aws-cdk-lib";

export class EventbridgeToFanout extends GuStack {
  constructor(scope: App, id: string, props: GuStackProps) {
    super(scope, id, props);

    const eventBridgeBus = new events.EventBus(this, "EventBridgeBus", {
      eventBusName: `${this.stack}-eventbridge-bus-${this.stage}`
    });

    const connection = new events.Connection(this, 'Connection', {
      authorization: events.Authorization.apiKey('Fastly-Key', SecretValue.secretsManager('FastlyFanoutApiKey')),
      description: "Fastly fanout authentication",
      connectionName: `fastly-fanout-connection-${this.stage}`
    });

    const destination = new events.ApiDestination(this, 'Destination', {
      connection,
      endpoint: `https://api.fastly.com/service/${process.env[`FASTLY_FANOUT_SERVICE_ID_${this.stage}`]}/publish/`,
      apiDestinationName: `fastly-fanout-api-destination-${this.stage}`
    });

    new events.Rule(this, "ApiDestinationRule", {
      eventBus: eventBridgeBus,
      ruleName: `${this.stack}-events-to-fastly-fanout-${this.stage}`,
      targets: [new targets.ApiDestination(destination, {
        event: events.RuleTargetInput.fromObject({"items":[{"channel":"test","formats":{"ws-message":{"content":"anyone there?"}}}]}),
        // todo: generate mapping for post request body to fastly fanout
        // curl -H "Fastly-Key: xxx" -d '{"items":[{"channel":"test","formats":{"ws-message":{"content":"anyone there?"}}}]}'
      //   https://stackoverflow.com/questions/64893782/creating-a-rule-with-a-constant-json-parameter-in-aws-cdk-c
      //   https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_PutEvents.html
      })],
      eventPattern: {
        region: [this.region]
      }
    })
  }
}
