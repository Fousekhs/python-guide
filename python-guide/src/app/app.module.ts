import { NgModule } from "@angular/core";
import { AppComponent } from "./app.component";
import { SectionComponent } from "./section/section.component";
import { SectionContainerComponent } from "./section-container/section-container.component";
import { BrowserModule } from "@angular/platform-browser";
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { environment } from "../environments/environment";


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    SectionComponent,
    SectionContainerComponent,
    BrowserModule
  ],
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideDatabase(() => getDatabase())
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }