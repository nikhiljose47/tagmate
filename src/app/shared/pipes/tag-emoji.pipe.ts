import { Pipe, PipeTransform } from '@angular/core';
import { tagEmoji } from '../utils/color.utils';

@Pipe({ name: 'tagEmoji', standalone: true, pure: true })
export class TagEmojiPipe implements PipeTransform {
  transform(tag: string | null | undefined): string {
    return tagEmoji(tag ?? '');
  }
}
