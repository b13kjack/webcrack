import * as t from '@babel/types';
import * as m from '@codemod/matchers';
import type { Transform } from '../../ast-utils';

export default {
  name: 'sequence',
  tags: ['safe'],
  visitor() {
    // To retain the evaluation order of `<anything> = (x(), y());`, only identifiers and member expressions are allowed.
    // `obj.foo.bar = (x(), y());` would trigger the getter for `obj.foo` before `x()` is evaluated.
    const assignmentVariable = m.or(
      m.identifier(),
      m.memberExpression(m.identifier(), m.identifier()),
    );
    const assignedSequence = m.capture(m.sequenceExpression());
    const assignmentMatcher = m.assignmentExpression(
      // "||=", "&&=", and "??=" have short-circuiting behavior
      m.or(
        '=',
        '+=',
        '-=',
        '*=',
        '/=',
        '%=',
        '**=',
        '<<=',
        '>>=',
        '>>>=',
        '|=',
        '^=',
        '&=',
      ),
      assignmentVariable,
      assignedSequence,
    );

    return {
      AssignmentExpression: {
        exit(path) {
          if (assignmentMatcher.match(path.node)) {
            const value = assignedSequence.current!.expressions.pop()!;
            path.get('right').replaceWith(value);
            const newNodes = path.parentPath.isExpressionStatement()
              ? assignedSequence.current!.expressions.map(t.expressionStatement)
              : assignedSequence.current!.expressions;
            path.insertBefore(newNodes);
            this.changes++;
          }
        },
      },
      ExpressionStatement: {
        exit(path) {
          if (t.isSequenceExpression(path.node.expression)) {
            const statements = path.node.expression.expressions.map((expr) =>
              t.expressionStatement(expr),
            );
            path.replaceWithMultiple(statements);
            this.changes++;
          }
        },
      },
      ReturnStatement: {
        exit(path) {
          if (t.isSequenceExpression(path.node.argument)) {
            const expressions = path.node.argument.expressions;
            path.node.argument = expressions.pop();
            const statements = expressions.map((expr) =>
              t.expressionStatement(expr),
            );
            path.insertBefore(statements);
            this.changes++;
          }
        },
      },
      IfStatement: {
        exit(path) {
          if (t.isSequenceExpression(path.node.test)) {
            const expressions = path.node.test.expressions;
            path.node.test = expressions.pop()!;
            const statements = expressions.map((expr) =>
              t.expressionStatement(expr),
            );
            path.insertBefore(statements);
            this.changes++;
          }
        },
      },
      SwitchStatement: {
        exit(path) {
          if (t.isSequenceExpression(path.node.discriminant)) {
            const expressions = path.node.discriminant.expressions;
            path.node.discriminant = expressions.pop()!;
            const statements = expressions.map((expr) =>
              t.expressionStatement(expr),
            );
            path.insertBefore(statements);
            this.changes++;
          }
        },
      },
      ThrowStatement: {
        exit(path) {
          if (t.isSequenceExpression(path.node.argument)) {
            const expressions = path.node.argument.expressions;
            path.node.argument = expressions.pop()!;
            const statements = expressions.map((expr) =>
              t.expressionStatement(expr),
            );
            path.insertBefore(statements);
            this.changes++;
          }
        },
      },
      ForInStatement: {
        exit(path) {
          const sequence = m.capture(m.sequenceExpression());
          const matcher = m.forInStatement(m.anything(), sequence);
          if (matcher.match(path.node)) {
            const expressions = sequence.current!.expressions;
            path.node.right = expressions.pop()!;
            const statements = expressions.map((expr) =>
              t.expressionStatement(expr),
            );
            path.insertBefore(statements);
            this.changes++;
          }
        },
      },
      ForStatement: {
        exit(path) {
          if (t.isSequenceExpression(path.node.init)) {
            const statements = path.node.init.expressions.map((expr) =>
              t.expressionStatement(expr),
            );
            path.insertBefore(statements);
            path.node.init = null;
            this.changes++;
          }
          if (
            t.isSequenceExpression(path.node.update) &&
            path.node.body.type === 'EmptyStatement'
          ) {
            const expressions = path.node.update.expressions;
            path.node.update = expressions.pop()!;
            const statements = expressions.map((expr) =>
              t.expressionStatement(expr),
            );
            path.node.body = t.blockStatement(statements);
            this.changes++;
          }
        },
      },
      WhileStatement: {
        exit(path) {
          if (t.isSequenceExpression(path.node.test)) {
            const expressions = path.node.test.expressions;
            path.node.test = expressions.pop()!;
            const statements = expressions.map((expr) =>
              t.expressionStatement(expr),
            );
            path.insertBefore(statements);
            this.changes++;
          }
        },
      },
      VariableDeclaration: {
        exit(path) {
          const sequence = m.capture(m.sequenceExpression());
          const matcher = m.variableDeclaration(undefined, [
            m.variableDeclarator(undefined, sequence),
          ]);
          if (matcher.match(path.node)) {
            const expressions = sequence.current!.expressions;
            path.node.declarations[0].init = expressions.pop();
            const statements = expressions.map((expr) =>
              t.expressionStatement(expr),
            );
            if (path.parentPath.isForStatement() && path.key === 'init') {
              path.parentPath.insertBefore(statements);
            } else {
              path.insertBefore(statements);
            }
            this.changes++;
          }
        },
      },
    };
  },
} satisfies Transform;
