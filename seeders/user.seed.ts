import mongoose, { connect, disconnect } from 'mongoose';
import {
  User,
  UserSchema,
  UserDocument,
  socialMediaProfilesDefaultValues,
} from '../src/users/user.schema';
import { users } from './users';

let localDB = 'mongodb://127.0.0.1:27017/comesh';
let liveDB =
  'mongodb+srv://Ghazanfar:ghazanfar-mongo@blog.e6jzl.mongodb.net/comesh';

async function seed() {
  // Replace with your MongoDB connection string

  const connectionString = liveDB;

  await connect(connectionString);

  // Convert coordinates to numbers before inserting users
  const usersWithNumericCoordinates = users.map((user) => ({
    ...user,
    location: {
      type: user.location.type,
      coordinates: user.location.coordinates.map(Number),
    },
  }));

  // Define the UserModel using the UserSchema
  const UserModel = mongoose.model<UserDocument>('User', UserSchema);

  // Insert users into the database
  await UserModel.insertMany(usersWithNumericCoordinates);
  console.log(`Inserted users into the database`);

  // Disconnect from the database
  await disconnect();

  console.log('Disconnected from the database');
}

seed();
