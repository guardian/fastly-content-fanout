import 'source-map-support/register';
import { GuRoot } from '@guardian/cdk/lib/constructs/root';
import { EventbridgeToFanout } from '../lib/eventbridge-to-fanout';

const app = new GuRoot();

const stack = 'cms-fronts';
const env = { region: 'eu-west-1' };

new EventbridgeToFanout(app, 'EventBridgeToFanout-eu-west-1-CODE', {
	stack,
	stage: 'CODE',
	env,
});
new EventbridgeToFanout(app, 'EventBridgeToFanout-eu-west-1-PROD', {
	stack,
	stage: 'PROD',
	env,
});
