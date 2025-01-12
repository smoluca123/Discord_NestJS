import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { handleDefaultError } from 'src/global/functions.global';
import {
  IPaginationResponseType,
  IResponseType,
} from 'src/interfaces/interfaces.global';
import {
  postCommentDataSelect,
  PostCommentDataType,
} from 'src/libs/prisma-types';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePostCommentDto } from 'src/resources/post-comment/dto/post-copmment.dto';

@Injectable()
export class PostCommentService {
  constructor(private readonly prisma: PrismaService) {}

  async createPostComment({
    authorId,
    postId,
    data,
  }: {
    authorId: string;
    postId: string;
    data: CreatePostCommentDto;
  }): Promise<IResponseType<PostCommentDataType>> {
    try {
      if (!postId) {
        throw new BadRequestException('Post id is required');
      }

      const postExist = await this.prisma.post.findUnique({
        where: {
          id: postId,
        },
        select: {
          id: true,
        },
      });
      if (!postExist) {
        throw new NotFoundException('Post not found');
      }

      const { content, replyToId } = data;
      let parentComment: { id: string; level: number } | null = null;
      if (replyToId) {
        parentComment = await this.prisma.postComment.findUnique({
          where: {
            id: replyToId,
          },
          select: {
            id: true,
            level: true,
          },
        });
        if (!parentComment) {
          throw new NotFoundException('Parent comment not found');
        }
      }

      const [, createdComment] = await this.prisma.$transaction([
        this.prisma.post.update({
          where: { id: postId },
          data: { commentCount: { increment: 1 } },
          select: null,
        }),
        this.prisma.postComment.create({
          data: {
            content,
            replyToId: replyToId || null,
            postId,
            authorId,
            level: replyToId ? parentComment.level + 1 : 0,
          },
          select: postCommentDataSelect,
        }),
        ...(replyToId && [
          this.prisma.postComment.update({
            where: { id: replyToId },
            data: { repliesCount: { increment: 1 } },
            select: null,
          }),
        ]),
      ]);
      return {
        message: 'Comment created successfully',
        data: createdComment,
        statusCode: 201,
        date: new Date(),
      };
    } catch (error) {
      handleDefaultError(error);
    }
  }

  async getPostComments({
    postId,
    page = 1,
    limit = 10,
    replyTo,
  }: {
    postId: string;
    page: number;
    limit: number;
    replyTo: string;
  }): Promise<IPaginationResponseType<PostCommentDataType>> {
    try {
      if (!postId) {
        throw new BadRequestException('Post id is required');
      }

      const postExist = await this.prisma.post.findUnique({
        where: {
          id: postId,
        },
        select: {
          id: true,
        },
      });
      if (!postExist) {
        throw new NotFoundException('Post not found');
      }

      const whereQuery: Prisma.PostCommentWhereInput = {
        postId,
        ...(replyTo && { replyToId: replyTo }),
      };

      const [comments, totalCount] = await this.prisma.$transaction([
        this.prisma.postComment.findMany({
          where: whereQuery,
          skip: (page - 1) * limit,
          take: limit,
          select: postCommentDataSelect,
        }),
        this.prisma.postComment.count({
          where: whereQuery,
        }),
      ]);

      const totalPage = Math.ceil(totalCount / limit);
      const hasNextPage = page * limit < totalCount;
      const hasPreviousPage = !!totalCount && page > 1;

      return {
        message: 'Get comments successfully',
        data: {
          currentPage: page,
          pageSize: limit,
          totalPage,
          totalCount,
          hasNextPage,
          hasPreviousPage,
          items: comments,
        },
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      handleDefaultError(error);
    }
  }

  // async handleDeletePostComment({
  //   commentId,
  //   authorId,
  // }: {
  //   commentId: string;
  //   authorId?: string;
  // }) {
  //   try {
  //     if (!commentId) {
  //       throw new BadRequestException('Comment id is required');
  //     }

  //     const commentExist = await this.prisma.postComment.findUnique({
  //       where: {
  //         id: commentId,
  //       },
  //       select: {
  //         id: true,
  //         postId: true,
  //         repliesCount: true,
  //         authorId: true,
  //         post: {
  //           select: {
  //             commentCount: true,
  //           },
  //         },
  //       },
  //     });
  //     if (!commentExist) {
  //       throw new NotFoundException('Comment not found');
  //     }

  //     const {
  //       postId,
  //       post: { commentCount },
  //     } = commentExist;

  //     if (authorId) {
  //       if (commentExist.authorId !== authorId) {
  //         throw new ForbiddenException('This comment is not yours');
  //       }
  //     }
  //     const [, deletedComment] = await this.prisma.$transaction([
  //       this.prisma.post.update({
  //         where: { id: postId },
  //         data: {
  //           commentCount: { decrement: commentCount > 0 ? 1 : 0 },
  //         },
  //         select: null,
  //       }),
  //       this.prisma.postComment.delete({
  //         where: { id: commentId },
  //         select: postCommentDataSelect,
  //       }),
  //     ]);
  //     if (deletedComment.replyToId) {
  //       const replyToComment = await this.prisma.postComment.findUnique({
  //         where: { id: deletedComment.replyToId },
  //         select: { id: true, repliesCount: true },
  //       });
  //       if (replyToComment) {
  //         await this.prisma.postComment.update({
  //           where: { id: deletedComment.replyToId },
  //           data: {
  //             repliesCount: {
  //               decrement: replyToComment.repliesCount > 0 ? 1 : 0,
  //             },
  //           },
  //           select: null,
  //         });
  //       }
  //     }

  //     return {
  //       message: 'Comment deleted successfully',
  //       data: deletedComment,
  //       statusCode: 200,
  //       date: new Date(),
  //     };
  //   } catch (error) {
  //     console.log(error);
  //     handleDefaultError(error);
  //   }
  // }

  async handleDeletePostComment({
    commentId,
    authorId,
  }: {
    commentId: string;
    authorId?: string;
  }) {
    try {
      if (!commentId) {
        throw new BadRequestException('Comment id is required');
      }

      const commentExist = await this.prisma.postComment.findUnique({
        where: { id: commentId },
        select: {
          id: true,
          postId: true,
          authorId: true,
          replyToId: true,
        },
      });

      if (!commentExist) {
        throw new NotFoundException('Comment not found');
      }

      if (authorId && commentExist.authorId !== authorId) {
        throw new ForbiddenException('This comment is not yours');
      }

      // Combine all operations in a single transaction
      const [, , deletedComment] = await this.prisma.$transaction([
        this.prisma.post.update({
          where: { id: commentExist.postId },
          data: { commentCount: { decrement: 1 } },
        }),

        // Update parent comment's replies count if this is a reply
        ...(commentExist.replyToId
          ? [
              this.prisma.postComment.update({
                where: { id: commentExist.replyToId },
                data: { repliesCount: { decrement: 1 } },
              }),
            ]
          : []),
        this.prisma.postComment.delete({
          where: { id: commentId },
          select: postCommentDataSelect,
        }),
      ]);

      return {
        message: 'Comment deleted successfully',
        data: deletedComment,
        statusCode: 200,
        date: new Date(),
      };
    } catch (error) {
      handleDefaultError(error);
    }
  }

  async deletePostComment({
    commentId,
    authorId,
  }: {
    commentId: string;
    authorId: string;
  }) {
    return this.handleDeletePostComment({ commentId, authorId });
  }

  async deletePostCommentByAdmin({ commentId }: { commentId: string }) {
    return this.handleDeletePostComment({ commentId });
  }
}
