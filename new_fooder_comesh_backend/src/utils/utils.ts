export abstract class Utils {
  public static OTPGenerator(otpDigits = 4) {
    var digits = '0123456789';
    let OTP = '';
    for (let i = 0; i < 4; i++) {
      OTP += digits[Math.floor(Math.random() * 10)];
    }
    return OTP;
  }

  public static  ageToDOB(age) {
 
    const currentDate = new Date();
    const birthYear = currentDate.getFullYear() - age;
    const dob = new Date(birthYear, 0, 1);
    const formattedDOB = dob.toISOString();
    return formattedDOB;
  }


}


