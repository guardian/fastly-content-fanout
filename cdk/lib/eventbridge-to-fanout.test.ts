import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EventbridgeToFanout } from './eventbridge-to-fanout';

describe('The EventBridgeToFanout stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new EventbridgeToFanout(app, 'EventBridgeToFanout', {
			stack: 'stack',
			stage: 'TEST',
			maybeSnsTopicCfnExportName: 'test-sns-topic-export-name',
		});
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
