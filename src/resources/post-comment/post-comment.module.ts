import { Module } from '@nestjs/common';
import { PostCommentService } from './post-comment.service';
import { PostCommentController } from './post-comment.controller';
import { PostModule } from 'src/resources/post/post.module';
import { PostService } from 'src/resources/post/post.service';

@Module({
  imports: [PostModule],
  controllers: [PostCommentController],
  providers: [PostCommentService, PostService],
})
export class PostCommentModule {}
