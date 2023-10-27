import "source-map-support/register";
import { GuRoot } from "@guardian/cdk/lib/constructs/root";
import { EventbridgeToFanout } from "../lib/eventbridge-to-fanout";

const app = new GuRoot();
new EventbridgeToFanout(app, "EventbridgeToFanout-euwest-1-CODE", { stack: "playground", stage: "CODE", env: { region: "eu-west-1" } });
new EventbridgeToFanout(app, "EventbridgeToFanout-euwest-1-PROD", { stack: "playground", stage: "PROD", env: { region: "eu-west-1" } });
