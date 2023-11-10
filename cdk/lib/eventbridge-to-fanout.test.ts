import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EventbridgeToFanout } from './eventbridge-to-fanout';

describe('The EventbridgeToFanout stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new EventbridgeToFanout(app, 'EventbridgeToFanout', {
			stack: 'playground',
			stage: 'TEST',
		});
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
