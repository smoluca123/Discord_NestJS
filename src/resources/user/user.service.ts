import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  generateSecureVerificationCode,
  handleDefaultError,
} from 'src/global/functions.global';
import {
  IDecodedAccecssTokenType,
  IResponseType,
} from 'src/interfaces/interfaces.global';
import { userDataSelect, UserDataType } from 'src/libs/prisma-types';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BanUserDto,
  UpdateProfileDto,
  UserActiveByCodeDto,
} from 'src/resources/user/dto/user.dto';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from 'src/supabase/supabase.service';
import { EmailService } from 'src/resources/email/email.service';
import { addMinutes, isPast } from 'date-fns';
import { JwtServiceCustom } from 'src/jwt/jwt.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService,
    private readonly jwt: JwtService,
    private readonly customJwt: JwtServiceCustom,
  ) {}

  /**
   * Retrieves user information based on the decoded access token.
   *
   * @param decodedAccessToken The decoded access token containing user information.
   * @returns A promise that resolves to an object containing the response type.
   */
  async getInfomation(
    decodedAccessToken: IDecodedAccecssTokenType,
  ): Promise<IResponseType<UserDataType>> {
    try {
      // Attempt to find the user by their ID from the decoded access token
      const user = await this.prisma.user.findUnique({
        where: {
          id: decodedAccessToken.userId,
        },
        // Select the fields to include in the user data
        select: userDataSelect,
      });

      // If no user is found, throw an exception
      if (!user) throw new NotFoundException('User not found');

      // Construct and return the response object
      return {
        message: 'Get user information successfully',
        data: user,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      // Handle any errors that occur during the process
      handleDefaultError(error);
    }
  }

  /**
   * Retrieves user information based on the provided user ID.
   *
   * @param userId The ID of the user to retrieve information for.
   * @returns A promise that resolves to an object containing the response type.
   */
  async getUserInfomation(
    userId: string,
  ): Promise<IResponseType<UserDataType>> {
    try {
      // Check if the userId is provided
      if (!userId) throw new BadRequestException('User ID is required');

      // Attempt to find the user by either their username or ID
      const user = await this.prisma.user.findFirst({
        where: {
          // Attempt to match the user by their username or ID
          OR: [{ username: userId }, { id: userId }],
        },
        // Select the fields to include in the user data
        select: userDataSelect,
      });

      // If no user is found, throw an exception
      if (!user) throw new NotFoundException('User not found');

      // Construct and return the response object
      return {
        message: 'Get user information successfully',
        data: user,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      // Handle any errors that occur during the process
      handleDefaultError(error);
    }
  }

  /**
   * Bans or unbans a user based on the provided data.
   *
   * @param userId The ID of the user to be banned or unbanned.
   * @param data The data object containing the ban status.
   * @returns A promise that resolves to an object containing the response type.
   */
  async banUser(
    userId: string,
    data: BanUserDto,
  ): Promise<IResponseType<null>> {
    try {
      // Check if the userId is provided
      if (!userId) throw new BadRequestException('User ID is required');

      // Update the user's ban status
      await this.prisma.user.update({
        where: { id: userId },
        data: { isBanned: data.isBanned },
      });

      // Construct the response message based on the ban status
      const action = data.isBanned ? 'Ban' : 'Unban';
      return {
        message: `${action} user successfully`,
        data: null,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      // Handle any errors that occur during the process
      handleDefaultError(error);
    }
  }

  async updateInfomation(
    decodedAccessToken: IDecodedAccecssTokenType,
    data: UpdateProfileDto,
  ) {
    try {
      // Iterate through each key in the data object to process the values.
      Object.keys(data).forEach(async (key) => {
        // If the value is not a boolean and is empty, set it to undefined.
        if (!data[key]) {
          data[key] = undefined;
          return;
        }
        // If the key is 'password', hash the value before updating.
        if (key === 'password') {
          data[key] = await bcrypt.hash(data[key], 10);
        }
      });
      // Update the user with the processed data.
      const user = await this.prisma.user.update({
        where: {
          id: decodedAccessToken.userId,
        },
        data,
        select: userDataSelect,
      });
      // Throw an error if the user is not found.
      if (!user) throw new NotFoundException('User not found');

      // Return a successful response with the updated user data.
      return {
        message: 'Update information successfully',
        data: user,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      // Handle any errors that occur during the process.
      handleDefaultError(error);
    }
  }

  /**
   * Updates the information of a user.
   *
   * @param userId The ID of the user whose information will be updated.
   * @param data The data object containing the updated information.
   * @returns A promise that resolves to an object containing the response type, including the user's updated information.
   */
  async updateUserInfomation(userId: string, data: UpdateProfileDto) {
    try {
      // Check if the userId is provided and throw an error if not.
      if (!userId) throw new BadRequestException('User ID is required');

      // Iterate through each key in the data object to process the values.
      Object.keys(data).forEach(async (key) => {
        // If the value is not a boolean and is empty, set it to undefined.
        if (typeof data[key] !== 'boolean' && !data[key]) {
          data[key] = undefined;
          return;
        }
        // If the key is 'password', hash the value before updating.
        if (key === 'password') {
          data[key] = await bcrypt.hash(data[key], 10);
        }
      });
      // Update the user with the processed data.
      const user = await this.prisma.user.update({
        where: {
          id: userId,
        },
        data,
        select: userDataSelect,
      });
      // Throw an error if the user is not found.
      if (!user) throw new NotFoundException('User not found');

      // Return a successful response with the updated user data.
      return {
        message: 'Update user information successfully',
        data: user,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      // Handle any errors that occur during the process.
      handleDefaultError(error);
    }
  }

  /**
   * Updates the avatar of a user.
   *
   * @param userId The ID of the user whose avatar will be updated.
   * @param file The file object containing the new avatar.
   * @returns A promise that resolves to an object containing the response type, including the user's updated avatar.
   */
  async updateUserAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<IResponseType<UserDataType>> {
    try {
      // Check if the userId is provided and throw an error if not.
      if (!userId) throw new BadRequestException('User ID is required');

      // Find the user by their ID to ensure they exist.
      const checkUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      // Throw an error if the user is not found.
      if (!checkUser) throw new NotFoundException('User not found');

      // Upload the file to the storage service and get the URL of the uploaded file.
      const { url } = await this.supabase.uploadFile(file);

      // Update the user's avatar with the URL of the uploaded file.
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { avatar: url },
        select: userDataSelect,
      });

      // Return a successful response with the updated user data.
      return {
        message: 'Update user avatar successfully',
        data: updatedUser,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      // Handle any errors that occur during the process.
      handleDefaultError(error);
    }
  }

  /**
   * Updates the credits of a user.
   *
   * @param userId The ID of the user whose credits will be updated.
   * @param data An object containing the updated credits amount.
   * @returns A promise that resolves to an object containing the response type, including the user's updated data.
   */
  async updateUserCredits(
    userId: string,
    data: {
      credits: number;
    },
  ): Promise<
    IResponseType<{
      id: string;
      username: string;
      credits: number;
    }>
  > {
    try {
      // Update the user's credits with the provided data.
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data,
        // Select the user's ID, username, and updated credits for the response.
        select: { id: true, username: true, credits: true },
      });

      // Check if the user was found and throw an exception if not.
      if (!updatedUser) throw new NotFoundException('User not found');

      // Return a successful response with the updated user data.
      return {
        message: 'Update user credits successfully',
        data: updatedUser,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      // Handle any errors that occur during the process.
      handleDefaultError(error);
    }
  }

  /**
   * Adds credits to a user's account.
   *
   * @param userId The ID of the user to whom credits will be added.
   * @param data An object containing the amount of credits to be added.
   * @returns A promise that resolves to an object containing the response type, including the user's updated data.
   */
  async addUserCredits(
    userId: string,
    data: {
      credits: number;
    },
  ): Promise<
    IResponseType<{
      id: string;
      username: string;
      credits: number;
    }>
  > {
    try {
      // Update the user's credits by incrementing the current amount with the provided data.
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          credits: {
            increment: data.credits,
          },
        },
        // Select the user's ID, username, and updated credits for the response.
        select: { id: true, username: true, credits: true },
      });

      // Check if the user was found and throw an exception if not.
      if (!updatedUser) throw new NotFoundException('User not found');

      // Return a successful response with the updated user data.
      return {
        message: 'Add user credits successfully',
        data: updatedUser,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      // Handle any errors that occur during the process.
      handleDefaultError(error);
    }
  }

  async sendVerificationEmail(userId: string): Promise<IResponseType> {
    try {
      // Define the expiration time in minutes
      const EXPIRATION_MINUTES = 10;
      const currentDate = new Date();
      // Check if userId is provided
      if (!userId) throw new BadRequestException('User ID is required');

      // Find the user by ID
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      // Check if user exists
      if (!user) throw new NotFoundException('User not found');
      // Check if user is already active
      if (user.isActive)
        throw new BadRequestException('User is already active');

      // Generate active code
      const checkCode = await this.prisma.activeCode.findFirst({
        where: {
          userId: user.id,
        },
      });

      // Determine the active code to use
      let activeCode = checkCode?.code || generateSecureVerificationCode();

      // If no active code exists, create a new one
      if (!checkCode) {
        await this.prisma.activeCode.create({
          data: {
            userId: user.id,
            code: activeCode,
            createdAt: currentDate,
            expiresAt: addMinutes(currentDate, EXPIRATION_MINUTES),
          },
        });
      } else {
        // Check if the existing active code has expired
        const isExpired = isPast(new Date(checkCode.expiresAt));
        if (isExpired) {
          // Generate a new active code if the existing one has expired
          activeCode = generateSecureVerificationCode();
          await this.prisma.activeCode.update({
            where: { id: checkCode.id },
            data: {
              code: activeCode,
              createdAt: currentDate,
              expiresAt: addMinutes(currentDate, EXPIRATION_MINUTES),
            },
          });
        }
      }

      // Send the verification email with the active code
      await this.emailService.sendActiveAccountEmail({
        email: user.email,
        context: {
          name: user.fullName,
          verification_code: activeCode, // TODO: Generate verification code
        },
      });

      // Return success response
      return {
        message: 'Verification email sent successfully',
        data: null,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      handleDefaultError(error);
    }
  }

  /**
   * Activate a user account using verification code
   * @param userId - ID of the user to activate
   * @param verificationData - Object containing verification code
   * @returns Response with activated user data
   */
  async userActiveByCode(
    userId: string,
    verificationData: UserActiveByCodeDto,
  ): Promise<IResponseType<UserDataType>> {
    try {
      // Validate user ID is provided
      if (!userId) throw new BadRequestException('User ID is required');

      // Find user by ID
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new NotFoundException('User not found');
      if (user.isActive) throw new ForbiddenException('User is already active');

      // Check if verification code exists and matches
      const checkCode = await this.prisma.activeCode.findFirst({
        where: {
          userId: user.id,
          code: verificationData.verifyCode,
        },
      });

      if (!checkCode) throw new ForbiddenException('Invalid verification code');

      // Check if verification code has expired
      const isExpired = isPast(new Date(checkCode.expiresAt));
      if (isExpired) throw new ForbiddenException('Verification code expired');

      // Delete used verification code
      await this.prisma.activeCode.delete({
        where: { id: checkCode.id },
      });

      // Update user status to active
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
        select: userDataSelect,
      });

      // Return success response
      return {
        message: 'User activated successfully',
        data: updatedUser,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      handleDefaultError(error);
    }
  }
}
