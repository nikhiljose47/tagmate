import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  isSignedIn: boolean = false;
  isToastOn: boolean = false;
  errorMsg: string = '';
  email = '';
  password = '';
  message = '';

  constructor(private auth: AuthService, private router: Router) { }


  async login() {
    try {
      await this.auth.login(this.email, this.password);
      this.message = '✅ Login successful!';
      this.router.navigate(['']);
    } catch (err) {
      this.message = '❌ Login failed. Check email/password.';
    }
  }

  async onLogin() {
  }


}
