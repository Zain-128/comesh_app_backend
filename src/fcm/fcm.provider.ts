import { Provider } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import path from 'path';

const filePath = path.resolve(
  __dirname,
  '../configs/comesh-7d906-firebase-adminsdk.json',
);

export const MessagingProvider = 'lib:messaging';

export const messagingProvider: Provider = {
  provide: MessagingProvider,
  useFactory: async () => {
    // const jsonString = fs.readFileSync(
    //   // '../configs/comesh-7d906-firebase-adminsdk.json',
    //   // 'utf-8',
    //   jsonFile,
    // );
    const jsonFile = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(jsonFile);

    await admin.initializeApp({
      credential: admin.credential.cert({
        projectId: jsonData.project_id,
        clientEmail: jsonData.client_email,
        privateKey: jsonData.private_key,
      }),
    });
    return admin.messaging(admin.app());
  },
};
