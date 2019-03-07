import * as hbs from '../types/handlebars-ast';
import { Lexer, LexItem, Result, Tokens, Debug } from './lexing';
import { HandlebarsLexerDelegate, TokenKind } from './lex';
import { Printer } from './printer';
import { assert } from '@glimmer/util';
import { JsonValue } from '@glimmer/interfaces';
import { combineContent } from './combine-content';
import { Diagnostic, HandlebarsParser } from './parse/core';

export function hbsLex(
  template: string,
  errors: Diagnostic[],
  debug: Debug
): Result<LexItem<TokenKind>[]> {
  let lexer = new Lexer(template, new HandlebarsLexerDelegate(debug), errors, debug);
  let out: Array<LexItem<TokenKind>> = [];

  while (true) {
    let result = lexer.next();

    if (result.status === 'err') return result;

    let item = result.value;
    out.push(item);

    if (isEOF(item)) break;
  }

  return { status: 'ok', value: out };
}

export class TokensImpl implements Tokens {
  private loopDetect = 0;
  constructor(private tokens: Array<LexItem<TokenKind>>, private pos = 0, private newline = true) {
    assert(
      tokens[tokens.length - 1].kind === TokenKind.EOF,
      `The last token must be EOF, was ${tokens[tokens.length - 1].kind}`
    );
  }

  clone(): Tokens {
    return new TokensImpl(this.tokens, this.pos, this.newline);
  }

  get isBeginningOfLine(): boolean {
    return this.newline;
  }

  get charPos(): number {
    if (this.pos === 0) {
      return 0;
    } else {
      let token = this.tokens[this.pos - 1];
      return token.span.end;
    }
  }

  get prevCharPos(): number | null {
    if (this.pos === 0) {
      return null;
    } else if (this.pos === 1) {
      return 0;
    } else {
      let token = this.tokens[this.pos - 2];
      return token.span.end;
    }
  }

  get nextCharPos(): number | null {
    if (this.pos >= this.tokens.length) {
      return null;
    } else {
      let token = this.tokens[this.pos + 1];
      return token.span.start;
    }
  }

  peek(): LexItem<TokenKind> {
    this.loopDetect++;
    if (this.loopDetect > 100) throw new Error('Infinite loop detected');
    return this.tokens[this.pos];
  }

  peek2(): LexItem<TokenKind> | undefined {
    this.loopDetect++;
    if (this.loopDetect > 100) throw new Error('Infinite loop detected');

    return this.tokens[this.pos + 1];
  }

  consume(): LexItem<TokenKind> {
    this.loopDetect = 0;
    let next = this.tokens[this.pos++];

    if (next.kind === TokenKind.Newline) {
      this.newline = true;
    } else {
      this.newline = false;
    }

    return next;
  }

  commit(fork: TokensImpl): void {
    if (this.pos !== fork.pos) {
      this.loopDetect = 0;
    }
    this.pos = fork.pos;
    this.newline = fork.newline;
  }
}

function isEOF(item: LexItem<TokenKind>): item is { kind: TokenKind.EOF; span: hbs.Span } {
  return item.kind === TokenKind.EOF;
}

export function hbsParse(
  template: string | hbs.AnyProgram
): { result: hbs.AnyProgram; errors: Diagnostic[] } {
  let debug: Debug = {
    trace(message) {
      console.info(message);
    },
  };

  if (typeof template === 'string') {
    let errors: Diagnostic[] = [];

    let tokens = hbsLex(template, errors, debug);

    if (tokens.status === 'err') return { result: lexErrorProgram(tokens.value.span), errors };

    let parser = new HandlebarsParser(template, new TokensImpl(tokens.value), debug);

    let program = parser.RootProgram();

    let result = combineContent(program);

    return { result, errors };
  } else {
    return { result: template, errors: [] };
  }
}

function lexErrorProgram(span: hbs.Span): hbs.AnyProgram {
  return { span, type: 'Program', body: [] };
}

export function hbsPrint(ast: hbs.AnyProgram): JsonValue {
  return new Printer().print(ast);
}
