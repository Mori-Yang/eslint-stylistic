/**
 * @fileoverview Rule to enforce spacing before and after keywords.
 * @author Toru Nagashima
 */

// MERGED: The JS version of this rule is merged to the TS version, this file will be removed
// in the next major when we remove the `@stylistic/eslint-plugin-js` package.

import type { ASTNode, JSONSchema, Token, Tree } from '#types'
import type { MessageIds, RuleOptions } from './types._js_'
import { isKeywordToken, isNotOpeningParenToken, isTokenOnSameLine } from '#utils/ast'
import { createRule } from '#utils/create-rule'
import { KEYWORDS_JS } from '#utils/keywords'

const PREV_TOKEN = /^[)\]}>]$/u
const NEXT_TOKEN = /^(?:[([{<~!]|\+\+?|--?)$/u
const PREV_TOKEN_M = /^[)\]}>*]$/u
const NEXT_TOKEN_M = /^[{*]$/u
const TEMPLATE_OPEN_PAREN = /\$\{$/u
const TEMPLATE_CLOSE_PAREN = /^\}/u
const CHECK_TYPE = /^(?:JSXElement|RegularExpression|String|Template|PrivateIdentifier)$/u
const KEYS = KEYWORDS_JS.concat(['as', 'async', 'await', 'from', 'get', 'let', 'of', 'satisfies', 'set', 'yield']);

// check duplications.
(function () {
  KEYS.sort()
  for (let i = 1; i < KEYS.length; ++i) {
    if (KEYS[i] === KEYS[i - 1])
      throw new Error(`Duplication was found in the keyword list: ${KEYS[i]}`)
  }
}())

/**
 * Checks whether or not a given token is a "Template" token ends with "${".
 * @param token A token to check.
 * @returns `true` if the token is a "Template" token ends with "${".
 */
function isOpenParenOfTemplate(token: Token) {
  return token.type === 'Template' && TEMPLATE_OPEN_PAREN.test(token.value)
}

/**
 * Checks whether or not a given token is a "Template" token starts with "}".
 * @param token A token to check.
 * @returns `true` if the token is a "Template" token starts with "}".
 */
function isCloseParenOfTemplate(token: Token) {
  return token.type === 'Template' && TEMPLATE_CLOSE_PAREN.test(token.value)
}

export default createRule<RuleOptions, MessageIds>({
  name: 'keyword-spacing',
  package: 'js',
  meta: {
    type: 'layout',

    docs: {
      description: 'Enforce consistent spacing before and after keywords',
    },

    fixable: 'whitespace',

    schema: [
      {
        type: 'object',
        properties: {
          before: { type: 'boolean', default: true },
          after: { type: 'boolean', default: true },
          overrides: {
            type: 'object',
            properties: KEYS.reduce<Record<string, JSONSchema.JSONSchema4>>((retv, key) => {
              retv[key] = {
                type: 'object',
                properties: {
                  before: { type: 'boolean' },
                  after: { type: 'boolean' },
                },
                additionalProperties: false,
              }
              return retv
            }, {}),
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      expectedBefore: 'Expected space(s) before "{{value}}".',
      expectedAfter: 'Expected space(s) after "{{value}}".',
      unexpectedBefore: 'Unexpected space(s) before "{{value}}".',
      unexpectedAfter: 'Unexpected space(s) after "{{value}}".',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode

    const tokensToIgnore = new WeakSet()

    /**
     * Reports a given token if there are not space(s) before the token.
     * @param token A token to report.
     * @param pattern A pattern of the previous token to check.
     */
    function expectSpaceBefore(token: Token, pattern: RegExp) {
      const prevToken = sourceCode.getTokenBefore(token)

      if (prevToken
        && (CHECK_TYPE.test(prevToken.type) || pattern.test(prevToken.value))
        && !isOpenParenOfTemplate(prevToken)
        && !tokensToIgnore.has(prevToken)
        && isTokenOnSameLine(prevToken, token)
        && !sourceCode.isSpaceBetween(prevToken, token)
      ) {
        context.report({
          loc: token.loc,
          messageId: 'expectedBefore',
          // @ts-expect-error index signature for string is missing
          data: token,
          fix(fixer) {
            return fixer.insertTextBefore(token, ' ')
          },
        })
      }
    }

    /**
     * Reports a given token if there are space(s) before the token.
     * @param token A token to report.
     * @param pattern A pattern of the previous token to check.
     */
    function unexpectSpaceBefore(token: Token, pattern: RegExp) {
      const prevToken = sourceCode.getTokenBefore(token)

      if (prevToken
        && (CHECK_TYPE.test(prevToken.type) || pattern.test(prevToken.value))
        && !isOpenParenOfTemplate(prevToken)
        && !tokensToIgnore.has(prevToken)
        && isTokenOnSameLine(prevToken, token)
        && sourceCode.isSpaceBetween(prevToken, token)
      ) {
        context.report({
          loc: { start: prevToken.loc.end, end: token.loc.start },
          messageId: 'unexpectedBefore',
          // @ts-expect-error index signature for string is missing
          data: token,
          fix(fixer) {
            return fixer.removeRange([prevToken.range[1], token.range[0]])
          },
        })
      }
    }

    /**
     * Reports a given token if there are not space(s) after the token.
     * @param token A token to report.
     * @param pattern A pattern of the next token to check.
     */
    function expectSpaceAfter(token: Token, pattern: RegExp) {
      const nextToken = sourceCode.getTokenAfter(token)

      if (nextToken
        && (CHECK_TYPE.test(nextToken.type) || pattern.test(nextToken.value))
        && !isCloseParenOfTemplate(nextToken)
        && !tokensToIgnore.has(nextToken)
        && isTokenOnSameLine(token, nextToken)
        && !sourceCode.isSpaceBetween(token, nextToken)
      ) {
        context.report({
          loc: token.loc,
          messageId: 'expectedAfter',
          // @ts-expect-error index signature for string is missing
          data: token,
          fix(fixer) {
            return fixer.insertTextAfter(token, ' ')
          },
        })
      }
    }

    /**
     * Reports a given token if there are space(s) after the token.
     * @param token A token to report.
     * @param pattern A pattern of the next token to check.
     */
    function unexpectSpaceAfter(token: Token, pattern: RegExp) {
      const nextToken = sourceCode.getTokenAfter(token)

      if (nextToken
        && (CHECK_TYPE.test(nextToken.type) || pattern.test(nextToken.value))
        && !isCloseParenOfTemplate(nextToken)
        && !tokensToIgnore.has(nextToken)
        && isTokenOnSameLine(token, nextToken)
        && sourceCode.isSpaceBetween(token, nextToken)
      ) {
        context.report({
          loc: { start: token.loc.end, end: nextToken.loc.start },
          messageId: 'unexpectedAfter',
          // @ts-expect-error index signature for string is missing
          data: token,
          fix(fixer) {
            return fixer.removeRange([token.range[1], nextToken.range[0]])
          },
        })
      }
    }

    type Options = NonNullable<RuleOptions[0]>

    /**
     * Parses the option object and determines check methods for each keyword.
     * @param options The option object to parse.
     * @returns - Normalized option object.
     *      Keys are keywords (there are for every keyword).
     *      Values are instances of `{"before": function, "after": function}`.
     */
    function parseOptions(options: Options = {}): Record<string, {
      before: (token: Token, pattern?: RegExp) => void
      after: (token: Token, pattern?: RegExp) => void
    }> {
      const before = options.before !== false
      const after = options.after !== false
      const defaultValue = {
        before: before ? expectSpaceBefore : unexpectSpaceBefore,
        after: after ? expectSpaceAfter : unexpectSpaceAfter,
      }
      const overrides = (options && options.overrides) || {} as any
      const retv = Object.create(null)

      for (let i = 0; i < KEYS.length; ++i) {
        const key = KEYS[i]
        const override = overrides[key]

        if (override) {
          const thisBefore = ('before' in override) ? override.before : before
          const thisAfter = ('after' in override) ? override.after : after

          retv[key] = {
            before: thisBefore ? expectSpaceBefore : unexpectSpaceBefore,
            after: thisAfter ? expectSpaceAfter : unexpectSpaceAfter,
          }
        }
        else {
          retv[key] = defaultValue
        }
      }

      return retv
    }

    const checkMethodMap = parseOptions(context.options[0]!)

    /**
     * Reports a given token if usage of spacing followed by the token is
     * invalid.
     * @param token A token to report.
     * @param [pattern] Optional. A pattern of the previous
     *      token to check.
     */
    function checkSpacingBefore(token: Token, pattern?: RegExp) {
      checkMethodMap[token.value].before(token, pattern || PREV_TOKEN)
    }

    /**
     * Reports a given token if usage of spacing preceded by the token is
     * invalid.
     * @param token A token to report.
     * @param [pattern] Optional. A pattern of the next
     *      token to check.
     */
    function checkSpacingAfter(token: Token, pattern?: RegExp) {
      checkMethodMap[token.value].after(token, pattern || NEXT_TOKEN)
    }

    /**
     * Reports a given token if usage of spacing around the token is invalid.
     * @param token A token to report.
     */
    function checkSpacingAround(token: Token) {
      checkSpacingBefore(token)
      checkSpacingAfter(token)
    }

    /**
     * Reports the first token of a given node if the first token is a keyword
     * and usage of spacing around the token is invalid.
     * @param node A node to report.
     */
    function checkSpacingAroundFirstToken(node: ASTNode | null) {
      const firstToken = node && sourceCode.getFirstToken(node)

      if (firstToken && firstToken.type === 'Keyword')
        checkSpacingAround(firstToken)
    }

    /**
     * Reports the first token of a given node if the first token is a keyword
     * and usage of spacing followed by the token is invalid.
     *
     * This is used for unary operators (e.g. `typeof`), `function`, and `super`.
     * Other rules are handling usage of spacing preceded by those keywords.
     * @param node A node to report.
     */
    function checkSpacingBeforeFirstToken(node: ASTNode | null) {
      const firstToken = node && sourceCode.getFirstToken(node)

      if (firstToken && firstToken.type === 'Keyword')
        checkSpacingBefore(firstToken)
    }

    /**
     * Reports the previous token of a given node if the token is a keyword and
     * usage of spacing around the token is invalid.
     * @param node A node to report.
     */
    function checkSpacingAroundTokenBefore(node: ASTNode | null) {
      if (node) {
        const token = sourceCode.getTokenBefore(node, isKeywordToken)

        if (token)
          checkSpacingAround(token)
      }
    }

    /**
     * Reports `async` or `function` keywords of a given node if usage of
     * spacing around those keywords is invalid.
     * @param node A node to report.
     */
    function checkSpacingForFunction(
      node:
        | Tree.FunctionDeclaration
        | Tree.ArrowFunctionExpression
        | Tree.FunctionExpression,
    ) {
      const firstToken = node && sourceCode.getFirstToken(node)

      if (firstToken
        && ((firstToken.type === 'Keyword' && firstToken.value === 'function')
          || firstToken.value === 'async')
      ) {
        checkSpacingBefore(firstToken)
      }
    }

    /**
     * Reports `class` and `extends` keywords of a given node if usage of
     * spacing around those keywords is invalid.
     * @param node A node to report.
     */
    function checkSpacingForClass(node: Tree.ClassDeclaration | Tree.ClassExpression) {
      checkSpacingAroundFirstToken(node)
      checkSpacingAroundTokenBefore(node.superClass)
    }

    /**
     * Reports `if` and `else` keywords of a given node if usage of spacing
     * around those keywords is invalid.
     * @param node A node to report.
     */
    function checkSpacingForIfStatement(node: Tree.IfStatement) {
      checkSpacingAroundFirstToken(node)
      checkSpacingAroundTokenBefore(node.alternate)
    }

    /**
     * Reports `try`, `catch`, and `finally` keywords of a given node if usage
     * of spacing around those keywords is invalid.
     * @param node A node to report.
     */
    function checkSpacingForTryStatement(node: Tree.TryStatement) {
      checkSpacingAroundFirstToken(node)
      checkSpacingAroundFirstToken(node.handler)
      checkSpacingAroundTokenBefore(node.finalizer)
    }

    /**
     * Reports `do` and `while` keywords of a given node if usage of spacing
     * around those keywords is invalid.
     * @param node A node to report.
     */
    function checkSpacingForDoWhileStatement(node: Tree.DoWhileStatement) {
      checkSpacingAroundFirstToken(node)
      checkSpacingAroundTokenBefore(node.test)
    }

    /**
     * Reports `for` and `in` keywords of a given node if usage of spacing
     * around those keywords is invalid.
     * @param node A node to report.
     */
    function checkSpacingForForInStatement(node: Tree.ForInStatement) {
      checkSpacingAroundFirstToken(node)

      const inToken = sourceCode.getTokenBefore(node.right, isNotOpeningParenToken)!
      const previousToken = sourceCode.getTokenBefore(inToken)

      // @ts-expect-error espree has PrivateIdentifier in tokens
      // https://github.com/eslint/espree/blob/1584ddb00f0b4e3ada764ac86ae20e1480003de3/lib/token-translator.js#L22C23-L22C23
      // but Tree.Token has not
      if (previousToken.type !== 'PrivateIdentifier')
        checkSpacingBefore(inToken)

      checkSpacingAfter(inToken)
    }

    /**
     * Reports `for` and `of` keywords of a given node if usage of spacing
     * around those keywords is invalid.
     * @param node A node to report.
     */
    function checkSpacingForForOfStatement(node: Tree.ForOfStatement) {
      if (node.await) {
        checkSpacingBefore(sourceCode.getFirstToken(node, 0)!)
        checkSpacingAfter(sourceCode.getFirstToken(node, 1)!)
      }
      else {
        checkSpacingAroundFirstToken(node)
      }

      const ofToken = sourceCode.getTokenBefore(node.right, isNotOpeningParenToken)!
      const previousToken = sourceCode.getTokenBefore(ofToken)

      // @ts-expect-error espree has PrivateIdentifier in tokens
      // https://github.com/eslint/espree/blob/1584ddb00f0b4e3ada764ac86ae20e1480003de3/lib/token-translator.js#L22C23-L22C23
      // but Tree.Token has not
      if (previousToken.type !== 'PrivateIdentifier')
        checkSpacingBefore(ofToken)

      checkSpacingAfter(ofToken)
    }

    /**
     * Reports `import`, `export`, `as`, and `from` keywords of a given node if
     * usage of spacing around those keywords is invalid.
     *
     * This rule handles the `*` token in module declarations.
     *
     *     import*as A from "./a"; /*error Expected space(s) after "import".
     *                               error Expected space(s) before "as".
     * @param node A node to report.
     */
    function checkSpacingForModuleDeclaration(
      node:
        | Tree.ExportNamedDeclaration
        | Tree.ExportDefaultDeclaration
        | Tree.ExportAllDeclaration
        | Tree.ImportDeclaration,
    ) {
      const firstToken = sourceCode.getFirstToken(node)!

      checkSpacingBefore(firstToken, PREV_TOKEN_M)
      checkSpacingAfter(firstToken, NEXT_TOKEN_M)

      if (node.type === 'ExportDefaultDeclaration')
        checkSpacingAround(sourceCode.getTokenAfter(firstToken)!)

      if (node.type === 'ExportAllDeclaration' && node.exported) {
        const asToken = sourceCode.getTokenBefore(node.exported)!

        checkSpacingBefore(asToken, PREV_TOKEN_M)
        checkSpacingAfter(asToken, NEXT_TOKEN_M)
      }

      if ('source' in node && node.source) {
        const fromToken = sourceCode.getTokenBefore(node.source)!

        checkSpacingBefore(fromToken, PREV_TOKEN_M)
        checkSpacingAfter(fromToken, NEXT_TOKEN_M)
      }
    }

    /**
     * Reports `as` keyword of a given node if usage of spacing around this
     * keyword is invalid.
     * @param node An `ImportSpecifier` node to check.
     */
    function checkSpacingForImportSpecifier(node: Tree.ImportSpecifier) {
      if (node.imported.range[0] !== node.local.range[0]) {
        const asToken = sourceCode.getTokenBefore(node.local)!

        checkSpacingBefore(asToken, PREV_TOKEN_M)
      }
    }

    /**
     * Reports `as` keyword of a given node if usage of spacing around this
     * keyword is invalid.
     * @param node An `ExportSpecifier` node to check.
     */
    function checkSpacingForExportSpecifier(node: Tree.ExportSpecifier) {
      if (node.local.range[0] !== node.exported.range[0]) {
        const asToken = sourceCode.getTokenBefore(node.exported)!

        checkSpacingBefore(asToken, PREV_TOKEN_M)
        checkSpacingAfter(asToken, NEXT_TOKEN_M)
      }
    }

    /**
     * Reports `as` keyword of a given node if usage of spacing around this
     * keyword is invalid.
     * @param node A node to report.
     */
    function checkSpacingForImportNamespaceSpecifier(node: Tree.ImportNamespaceSpecifier) {
      const asToken = sourceCode.getFirstToken(node, 1)!

      checkSpacingBefore(asToken, PREV_TOKEN_M)
    }

    /**
     * Reports `static`, `get`, and `set` keywords of a given node if usage of
     * spacing around those keywords is invalid.
     * @param node A node to report.
     * @throws {Error} If unable to find token get, set, or async beside method name.
     */
    function checkSpacingForProperty(node: Tree.MethodDefinition | Tree.PropertyDefinition | Tree.Property) {
      if ('static' in node && node.static)
        checkSpacingAroundFirstToken(node)

      if ((<Tree.Property>node).kind === 'get'
        || (<Tree.Property>node).kind === 'set'
        || (
          (('method' in node && node.method) || node.type === 'MethodDefinition')
          && 'async' in node.value && node.value.async
        )
      ) {
        const token = sourceCode.getTokenBefore(
          node.key,
          (tok) => {
            switch (tok.value) {
              case 'get':
              case 'set':
              case 'async':
                return true
              default:
                return false
            }
          },
        )

        if (!token)
          throw new Error('Failed to find token get, set, or async beside method name')

        checkSpacingAround(token)
      }
    }

    /**
     * Reports `await` keyword of a given node if usage of spacing before
     * this keyword is invalid.
     * @param node A node to report.
     */
    function checkSpacingForAwaitExpression(node: Tree.AwaitExpression) {
      checkSpacingBefore(sourceCode.getFirstToken(node)!)
    }

    return {

      // Statements
      'DebuggerStatement': checkSpacingAroundFirstToken,
      'WithStatement': checkSpacingAroundFirstToken,

      // Statements - Control flow
      'BreakStatement': checkSpacingAroundFirstToken,
      'ContinueStatement': checkSpacingAroundFirstToken,
      'ReturnStatement': checkSpacingAroundFirstToken,
      'ThrowStatement': checkSpacingAroundFirstToken,
      'TryStatement': checkSpacingForTryStatement,

      // Statements - Choice
      'IfStatement': checkSpacingForIfStatement,
      'SwitchStatement': checkSpacingAroundFirstToken,
      'SwitchCase': checkSpacingAroundFirstToken,

      // Statements - Loops
      'DoWhileStatement': checkSpacingForDoWhileStatement,
      'ForInStatement': checkSpacingForForInStatement,
      'ForOfStatement': checkSpacingForForOfStatement,
      'ForStatement': checkSpacingAroundFirstToken,
      'WhileStatement': checkSpacingAroundFirstToken,

      // Statements - Declarations
      'ClassDeclaration': checkSpacingForClass,
      'ExportNamedDeclaration': checkSpacingForModuleDeclaration,
      'ExportDefaultDeclaration': checkSpacingForModuleDeclaration,
      'ExportAllDeclaration': checkSpacingForModuleDeclaration,
      'FunctionDeclaration': checkSpacingForFunction,
      'ImportDeclaration': checkSpacingForModuleDeclaration,
      'VariableDeclaration': checkSpacingAroundFirstToken,

      // Expressions
      'ArrowFunctionExpression': checkSpacingForFunction,
      'AwaitExpression': checkSpacingForAwaitExpression,
      'ClassExpression': checkSpacingForClass,
      'FunctionExpression': checkSpacingForFunction,
      'NewExpression': checkSpacingBeforeFirstToken,
      'Super': checkSpacingBeforeFirstToken,
      'ThisExpression': checkSpacingBeforeFirstToken,
      'UnaryExpression': checkSpacingBeforeFirstToken,
      'YieldExpression': checkSpacingBeforeFirstToken,

      // Others
      'ImportSpecifier': checkSpacingForImportSpecifier,
      'ExportSpecifier': checkSpacingForExportSpecifier,
      'ImportNamespaceSpecifier': checkSpacingForImportNamespaceSpecifier,
      'MethodDefinition': checkSpacingForProperty,
      'PropertyDefinition': checkSpacingForProperty,
      'StaticBlock': checkSpacingAroundFirstToken,
      'Property': checkSpacingForProperty,

      // To avoid conflicts with `space-infix-ops`, e.g. `a > this.b`
      'BinaryExpression[operator=\'>\']': function (node: Tree.BinaryExpression) {
        const operatorToken = sourceCode.getTokenBefore(node.right, isNotOpeningParenToken)!

        tokensToIgnore.add(operatorToken)
      },
    }
  },
})
