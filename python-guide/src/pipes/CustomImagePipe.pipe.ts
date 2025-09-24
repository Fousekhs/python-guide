import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'customImage' })
export class CustomImagePipe implements PipeTransform {
  transform(text: string): string {
    // Regex to match img:whatever
    return text.replace(/img:([A-Za-z0-9_-]+)\.(png|jpe?g)/g, (match, imageName) => {
      const pic = match.split(':')[1];
      // Output HTML <img>
      return `<img [ngSrc]="/assets/${pic}" alt="${pic}">`;
    });
  }
}
