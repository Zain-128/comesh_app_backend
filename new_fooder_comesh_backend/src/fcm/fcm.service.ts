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

  private tokenLabel(token: string | undefined): string {
    if (!token) {
      return 'empty';
    }
    return `len=${token.length} ${token.slice(0, 8)}...${token.slice(-8)}`;
  }

  private buildApnsAlert(title: string, body: string) {
    return {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'default',
        },
      },
    };
  }

  /** Must match RN `notifee.createChannel({ id: "comesh" })` (Splash2) or Android may drop heads-up. */
  private android: any = {
    priority: 'high',
    notification: {
      channelId: 'comesh',
      defaultSound: true,
    },
  };

  async sendMessageToTokens(params: any): Promise<string[]> {
    const { title, body, payload, tokens } = params;
    const data = this.normalizeDataPayload({
      title,
      body,
      ...(payload as Record<string, unknown> | undefined),
    });
    console.log('[CoMesh/FCM] sendMessageToTokens:start', {
      tokens: (tokens || []).map((token: string) => this.tokenLabel(token)),
      title,
      body,
      data,
    });
    return await this.messaging
      .sendEachForMulticast({
        tokens: tokens,
        ...(data ? { data } : {}),
        notification: {
          title: title,
          body: body,
        },
        android: this.android,
        apns: this.buildApnsAlert(title, body),
      })
      .then((response) => {
        console.log('[CoMesh/FCM] sendMessageToTokens:response', {
          successCount: response.successCount,
          failureCount: response.failureCount,
          responses: response.responses.map((resp, idx) => ({
            token: this.tokenLabel(tokens[idx]),
            success: resp.success,
            messageId: resp.messageId,
            error: resp.error?.message,
            code: resp.error?.code,
          })),
        });
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
    const data = this.normalizeDataPayload({
      title,
      body,
      ...(payload as Record<string, unknown> | undefined),
    });
    return await this.messaging
      .send({
        topic: topic,
        ...(data ? { data } : {}),
        notification: {
          title: title,
          body: body,
        },
        android: this.android,
        apns: this.buildApnsAlert(title, body),
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
    const data = this.normalizeDataPayload({
      title,
      body,
      ...(payload as Record<string, unknown> | undefined),
    });
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
        apns: this.buildApnsAlert(title, body),
      })
      .catch((err) => {
        throw new HttpException(
          `Error sending message: ${err.message}`,
          HttpStatus.NO_CONTENT,
        );
      });
  }
}
