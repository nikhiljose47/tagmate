export interface Tag {
  id?: string;
  username: string;
  userId: string;
  highlight: string;
  lat: number;
  lng: number;
  expiresIn: number;
  tag: string;
  createdAt: string;
  images: string[];
  hoodId?: string;
  country?: string;
  loves?: number;
  dislikes?: number;
  comments?: string[];
  kind?: 'post' | 'event';
  eventStart?: string;
  eventEnd?: string;
  category?: string;
}

export interface ThreadedComment {
  id: string;
  postId: string;
  author: string;
  text: string;
  createdAt: string;
  upvotes: number;
  mentions: string[];
  parentId?: string;
}

export interface DirectMessage {
  id: string;
  threadId: string;
  postId: string;
  from: string;
  to: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface LocalNotification {
  id: string;
  type: 'reply' | 'love' | 'alert' | 'rsvp' | 'message';
  title: string;
  body: string;
  postId?: string;
  createdAt: string;
  read: boolean;
}
