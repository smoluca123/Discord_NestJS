import { WebSocketGateway } from '@nestjs/websockets';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class PostGateway {}
