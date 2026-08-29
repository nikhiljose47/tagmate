import { Pipe, PipeTransform } from '@angular/core';
import { readableTextColor } from '../utils/color.utils';

@Pipe({ name: 'contrastText', standalone: true, pure: true })
export class ContrastTextPipe implements PipeTransform {
  transform(bg: string | null | undefined): string | null {
    return readableTextColor(bg);
  }
}
