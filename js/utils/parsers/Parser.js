export class Parser {
  parse(text) {
    throw new Error('parse() must be implemented by subclass');
  }

  validate(text) {
    return text && text.trim().length > 0;
  }
}