import {AfterViewChecked, Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {IMessage} from '../../../../../shared/models/messaging/IMessage';
import {MessageService} from '../shared/services/message.service';
import {ChatService} from '../shared/services/chat.service';
import {UserService} from '../shared/services/user.service';
import {SocketIOEvent} from '../../../../../shared/models/messaging/SoketIOEvent';
import {ISocketIOMessage, SocketIOMessageType} from '../../../../../shared/models/messaging/ISocketIOMessage';


enum MessagingMode {
  CHAT = 'chat',
  COMMENT = 'comment'
}

@Component({
  selector: 'app-messaging',
  templateUrl: './messaging.component.html',
  styleUrls: ['./messaging.component.scss']
})
export class MessagingComponent implements OnInit, AfterViewChecked {

  @Input() room: string;
  @Input() mode: MessagingMode = MessagingMode.CHAT;
  // number of messages to load
  @Input() limit = 20;
  chatName: string;
  @ViewChild('messageList') messageList: ElementRef;
  messages: IMessage[] = [];
  // number of message in a given room
  messageCount: number;
  ioConnection: any;
  queryParam: any;
  disableInfiniteScroll = false;
  scrollToBottom = true;

  constructor(
    private messageService: MessageService,
    private chatService: ChatService,
    private userService: UserService,
  ) {
  }

  ngOnInit() {
    this.queryParam = {
      room: this.room,
      limit: this.limit,
      order: (this.mode === MessagingMode.CHAT) ? -1 : 1
    };
    this.init();
  }

  ngAfterViewChecked() {
    if (this.scrollToBottom && this.mode === MessagingMode.CHAT) {
      this.messageList.nativeElement.scrollIntoView(false);
    }
  }

  async init() {
    if (this.room) {
      this.queryParam = Object.assign(this.queryParam, {room: this.room});
      const res = await this.messageService.getMessageCount(this.queryParam);
      this.messageCount = res.count;
      const _messages = await this.messageService.getMessages(this.queryParam);
      this.messages = this.mode === 'chat' ? _messages.reverse() : _messages;
      this.chatName = this.getChatName();
      this.initSocketConnection();
    }
  }

  /**
   *  generate chat-name for the user in a given chat room
   * @returns {string}
   */
  private getChatName(): string {
    // look if user have contributed in the chat room
    // if yes return his previous chatName.
    const match = this.messages.find((message: IMessage) => {
      return message.author === this.userService.user._id;
    });

    if (match) {
      return match.chatName;
    }

    // if user haven't contributed in the chat generate new chatName
    return this.userService.user.role + Date.now();
  }

  /**
   * initialise WebSocket connection
   *  and applies listeners
   */
  initSocketConnection(): void {
    this.chatService.initSocket(this.room);

    this.ioConnection = this.chatService.onMessage()
      .subscribe(this.handleNewMessage.bind(this));
  }

  /**
   * handle SocketIO incoming message
   * @param {ISocketIOMessage} socketIOMessage
   */
  handleNewMessage(socketIOMessage: ISocketIOMessage): void {
    if (socketIOMessage.meta.type === SocketIOMessageType.COMMENT) {
      const match = this.messages.find((msg: IMessage) => {
        return msg._id === socketIOMessage.meta.parent;
      });

      if (match) {
        match.comments.push(socketIOMessage.message);
      }
    } else {
      this.messages.push(socketIOMessage.message);
    }
  }


  async loadMoreMsg() {
    this.queryParam = Object.assign(this.queryParam, {skip: this.messages.length});
    const _messages: IMessage[] = await this.messageService.getMessages(this.queryParam);
    this.messages = (this.mode === 'chat') ? _messages.reverse().concat(this.messages) : this.messages.concat(_messages.reverse());
    if (this.messages.length === this.messageCount) {
      this.disableInfiniteScroll = true;
    }
  }


  async onScrollDown() {
    if (this.mode === 'comment') {
      await this.loadMoreMsg();
    }
  }

  async onScrollUp() {
    if (this.mode === 'chat') {
      this.scrollToBottom = false;
      await this.loadMoreMsg();
    }
  }
}
