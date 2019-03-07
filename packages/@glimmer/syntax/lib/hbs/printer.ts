import * as hbs from '../types/handlebars-ast';
import { JsonValue } from '@glimmer/interfaces';

export class Printer {
  print(ast: hbs.AnyProgram): JsonValue {
    console.log(ast);
    return ['concat', this.top(ast)];
  }

  top(ast: hbs.AnyProgram): JsonValue {
    let out = [];

    console.log(ast);

    if (ast.body) {
      for (let item of ast.body) {
        out.push(this.visit(item));
      }
    }

    return out;
  }

  statements(statements: hbs.Statement[] | null): JsonValue[] {
    let out = [];

    if (statements) {
      for (let item of statements) {
        out.push(this.visit(item));
      }
    }

    return out;
  }

  visit(item: hbs.Statement | hbs.Program): JsonValue {
    switch (item.type) {
      case 'CommentStatement':
        return ['comment', `s:${item.value}`];

      case 'HtmlCommentNode':
        return ['html-comment', `s:${item.value}`];

      case 'TextNode':
        return `s:${item.value}`;

      case 'ElementNode': {
        let sexp: JsonValue[] = ['element'];
        sexp.push(this.expr(item.tag));

        if (item.attributes) {
          let out: JsonValue = {};
          let attrs = item.attributes;

          for (let attr of attrs) {
            let key = attr.name.name;
            let value = attr.value;

            if (value === null) {
              out[key] = null;
            } else {
              out[key] = this.visit(value);
            }
          }

          sexp.push(out);
        }

        if (item.body) sexp.push(this.program(item.body));
        return sexp;
      }

      case 'BlockStatement': {
        let sexp: JsonValue[] = ['block'];

        sexp.push(this.program(item.program));

        if (item.inverses) {
          for (let block of item.inverses) {
            sexp.push(this.program(block));
          }
        }

        return sexp;
      }

      case 'MustacheStatement': {
        return this.callBody(item.body);
      }

      case 'MustacheContent':
        return this.expr(item.value);

      case 'ConcatStatement': {
        let parts = item.parts;
        let out: JsonValue = ['concat'];

        for (let part of parts) {
          out.push(this.visit(part));
        }

        return out;
      }

      case 'Newline':
        return '\n';

      default:
        throw new Error(`unimplemented Printer for ${item.type}`);
    }
  }

  callBody(item: hbs.CallBody): JsonValue[] {
    let sexp = [];

    sexp.push(this.expr(item.call));

    if (item.params) {
      for (let param of item.params) {
        sexp.push(this.expr(param));
      }
    }

    if (item.hash) {
      let hash: JsonValue = {};
      for (let pair of item.hash.pairs) {
        hash[pair.key] = this.expr(pair.value);
      }
      sexp.push(hash);
    }

    if (item.blockParams) sexp.push({ as: item.blockParams.params.map(b => b.name) });
    return sexp;
  }

  program(item: hbs.Program): JsonValue[] {
    let call: JsonValue[] = [];

    if (item.call !== null) {
      call = this.callBody(item.call);
    }

    let body = this.statements(item.body);

    return [call, ...body];
  }

  expr(item: hbs.Expression): JsonValue | JsonValue[] {
    switch (item.type) {
      case 'PathExpression': {
        if (item.tail) {
          let out = ['get-path', this.head(item.head)];
          if (item.tail.length) out.push(...this.segments(item.tail));
          return out;
        } else {
          return this.head(item.head);
        }
      }

      case 'NumberLiteral':
        return item.value;

      case 'StringLiteral':
        return `s:${item.value}`;

      case 'BooleanLiteral':
        return `%${item.value}%`;

      case 'UndefinedLiteral':
        return '%undefined%';

      case 'NullLiteral':
        return '%null%';

      case 'SubExpression':
        return this.subexpr(item);
    }
  }

  path(item: hbs.PathExpression): JsonValue[] | JsonValue {
    if (item.tail) {
      let out = ['get-path', this.head(item.head)];
      if (item.tail.length) out.push(...this.segments(item.tail));
      return out;
    } else {
      return this.head(item.head);
    }
  }

  subexpr(item: hbs.SubExpression): JsonValue[] {
    return this.callBody(item.body);
  }

  head(item: hbs.Head): JsonValue {
    switch (item.type) {
      case 'ArgReference':
        return `@${item.name}`;
      case 'LocalReference':
        return item.name;
      case 'This':
        return '%this%';
    }
  }

  segments(segments: hbs.PathSegment[]): string[] {
    return segments.map(s => `s:${s.name}`);
  }
}
