import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'login',
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  isSignedIn: boolean = false;
  isToastOn: boolean = false;
  errorMsg: string = '';

  login(){}
  onLogin(){}
}
