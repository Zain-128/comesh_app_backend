import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { MessagingProvider } from './fcm.provider';

import * as admin from 'firebase-admin';

@Injectable()
export class FCMMessagingService {
  constructor(
    @Inject(MessagingProvider)
    private readonly messaging: admin.messaging.Messaging,
  ) {}
  /** Must match RN `notifee.createChannel({ id: "comesh" })` (Splash2) or Android may drop heads-up. */
  private android: any = {
    priority: 'high',
    notification: {
      channelId: 'comesh',
      defaultSound: true,
    },
  };

  private apns = {
    payload: {
      aps: {
        contentAvailable: true,
      },
    },
    headers: {
      'apns-priority': '5', // Must be `5` when `contentAvailable` is set to true.
    },
  };

  async sendMessageToTokens(params: any): Promise<string[]> {
    const { title, body, payload, tokens } = params;
    return await this.messaging
      .sendEachForMulticast({
        tokens: tokens,
        data: payload,
        notification: {
          title: title,
          body: body,
        },
        android: this.android,
        apns: this.apns,
      })
      .then((response) => {
        console.log({ response, b: response.responses[0].error });
        if (response.failureCount > 0) {
          const failedTokens: string[] = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              failedTokens.push(tokens[idx]);
            }
          });
          return failedTokens;
        } else {
          return [];
        }
      })
      .catch((err) => {
        console.log({ err });
        throw new HttpException(
          `Error sending message: ${err.message}`,
          HttpStatus.NO_CONTENT,
        );
      });
  }

  async sendMessageToTopic(params: any): Promise<string> {
    const { title, body, payload, topic } = params;
    return await this.messaging
      .send({
        topic: topic,
        data: payload,
        notification: {
          title: title,
          body: body,
        },
        android: this.android,
        apns: this.apns,
      })
      .catch((err) => {
        throw new HttpException(
          `Error sending message: ${err.message}`,
          HttpStatus.NO_CONTENT,
        );
      });
  }

  /**
   *
   * @param title
   * @param body
   * @param condition You can include up to five topics in your conditional expression. I.E. "'TopicA' in topics && ('TopicB' in topics || 'TopicC' in topics)"
   * @returns
   */
  async sendMessageToCondition(params: any): Promise<string> {
    const { title, body, payload, condition } = params;
    // sample condition: "'TopicA' in topics && ('TopicB' in topics || 'TopicC' in topics)"
    return await this.messaging
      .send({
        condition: condition,
        data: payload,
        notification: {
          title: title,
          body: body,
        },
        android: this.android,
        apns: this.apns,
      })
      .catch((err) => {
        throw new HttpException(
          `Error sending message: ${err.message}`,
          HttpStatus.NO_CONTENT,
        );
      });
  }
}
