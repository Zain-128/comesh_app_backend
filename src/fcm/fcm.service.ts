import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { MessagingProvider } from './fcm.provider';

import * as admin from 'firebase-admin';

@Injectable()
export class FCMMessagingService {
  constructor(
    @Inject(MessagingProvider)
    private readonly messaging: admin.messaging.Messaging,
  ) {}

  private normalizeDataPayload(
    payload: Record<string, unknown> | undefined,
  ): Record<string, string> | undefined {
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [
        k,
        v == null ? '' : String(v),
      ]),
    );
  }
  /** Must match RN `notifee.createChannel({ id: "comesh" })` (Splash2) or Android may drop heads-up. */
  private android: any = {
    priority: 'high',
    notification: {
      channelId: 'comesh',
      defaultSound: true,
    },
  };

  /**
   * Visible alerts (OTP, chat): priority 10 + sound — **not** content-available (priority 5),
   * which targets background/silent pushes and often suppresses banners on iOS.
   */
  private apnsAlert = {
    headers: {
      'apns-priority': '10',
    },
    payload: {
      aps: {
        sound: 'default',
      },
    },
  };

  async sendMessageToTokens(params: any): Promise<string[]> {
    const { title, body, payload, tokens } = params;
    const data = this.normalizeDataPayload(payload as Record<string, unknown>);
    return await this.messaging
      .sendEachForMulticast({
        tokens: tokens,
        ...(data ? { data } : {}),
        notification: {
          title: title,
          body: body,
        },
        android: this.android,
        apns: this.apnsAlert,
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
    const data = this.normalizeDataPayload(payload as Record<string, unknown>);
    return await this.messaging
      .send({
        topic: topic,
        ...(data ? { data } : {}),
        notification: {
          title: title,
          body: body,
        },
        android: this.android,
        apns: this.apnsAlert,
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
    const data = this.normalizeDataPayload(payload as Record<string, unknown>);
    // sample condition: "'TopicA' in topics && ('TopicB' in topics || 'TopicC' in topics)"
    return await this.messaging
      .send({
        condition: condition,
        ...(data ? { data } : {}),
        notification: {
          title: title,
          body: body,
        },
        android: this.android,
        apns: this.apnsAlert,
      })
      .catch((err) => {
        throw new HttpException(
          `Error sending message: ${err.message}`,
          HttpStatus.NO_CONTENT,
        );
      });
  }
}
