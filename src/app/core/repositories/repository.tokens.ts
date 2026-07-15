import { InjectionToken } from '@angular/core';
import { ITagRepository } from './interfaces/tag.repository';
import { IUserRepository } from './interfaces/user.repository';

export const TAG_REPOSITORY = new InjectionToken<ITagRepository>('ITagRepository');
export const USER_REPOSITORY = new InjectionToken<IUserRepository>('IUserRepository');
