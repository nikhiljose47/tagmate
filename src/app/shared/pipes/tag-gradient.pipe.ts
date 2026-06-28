import { Pipe, PipeTransform } from '@angular/core';
import { tagGradient } from '../utils/color.utils';

@Pipe({ name: 'tagGradient', standalone: true, pure: true })
export class TagGradientPipe implements PipeTransform {
  transform(tag: string | null | undefined): string {
    return tagGradient(tag ?? '');
  }
}
