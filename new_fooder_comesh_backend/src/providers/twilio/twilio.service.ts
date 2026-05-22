// import PQueue from 'p-queue';
// import pRetry from 'p-retry';
import twilio from 'twilio';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message';
import TwilioClient from 'twilio/lib/rest/Twilio';

@Injectable()
export class TwilioService {
  client: TwilioClient;

  //   logger = new Logger(TwilioService.name);

  //   private queue = new PQueue({ concurrency: 1 });

  constructor() {
    // private configService: ConfigService
    // const twilioAccountSid =
    //   this.configService.get<string>('twilio.accountSid');
    // const twilioAuthToken = this.configService.get<string>('twilio.authToken');

    const twilioAccountSid = 'ACd89672b970ed5dbe6639d838ebf7f36d';
    const twilioAuthToken = '709cc12c2746a138d9e95756d8d366be';

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error('Twilio account SID/auth token not found');
    }

    this.client = twilio(twilioAccountSid, twilioAuthToken);
  }

  //   private async sendSms(options: MessageListInstanceCreateOptions) {
  //     return this.client.messages.create(options);
  //   }

  async sendMessage(to: string, body: string) {
    try {
      await this.client.messages.create({
        body,
        to,
        // from: process.env.TWILIO_PHONE_NUMBER,
        from: '+17065842722',
      });
    } catch (error) {
      console.log(error);
      if (error.code) {
        return {
          success: false,
          message: error.message,
          data: null,
        };
      }
    }
  }

  //   send(options: MessageListInstanceCreateOptions) {
  //     return this.queue.add(() =>
  //       pRetry(() => this.sendSms(options), {
  //         onFailedAttempt: (error) => {
  //           this.logger.debug(
  //             `SMS to ${options.to} failed, retrying (${error.retriesLeft} attempts left)`,
  //             error,
  //           );
  //         },
  //         retries: this.configService.get<number>('twilio.retries') ?? 3,
  //       }),
  //     );
  //   }
}
