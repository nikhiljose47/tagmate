import { Component, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Login } from './components/login/login';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Login],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('tagmate');

  constructor(private router: Router){}

  signIn(){
    this.router.navigate(['/login']);
  }
}
