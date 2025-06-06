/**
 * @fileoverview Rule to validate spacing before function paren.
 * @author Mathias Schreck <https://github.com/lo1tuma>
 */

import type { Tree } from '#types'
import type { MessageIds, RuleOptions } from './types._js_'
// TODO: Stage 3: Isn't inherited by ts version, can delete directly
import { isOpeningParenToken } from '#utils/ast'
import { createRule } from '#utils/create-rule'

export default createRule<RuleOptions, MessageIds>({
  name: 'space-before-function-paren',
  package: 'js',
  meta: {
    type: 'layout',

    docs: {
      description: 'Enforce consistent spacing before `function` definition opening parenthesis',
    },

    fixable: 'whitespace',

    schema: [
      {
        oneOf: [
          {
            type: 'string',
            enum: ['always', 'never'],
          },
          {
            type: 'object',
            properties: {
              anonymous: {
                type: 'string',
                enum: ['always', 'never', 'ignore'],
              },
              named: {
                type: 'string',
                enum: ['always', 'never', 'ignore'],
              },
              asyncArrow: {
                type: 'string',
                enum: ['always', 'never', 'ignore'],
              },
            },
            additionalProperties: false,
          },
        ],
      },
    ],

    messages: {
      unexpectedSpace: 'Unexpected space before function parentheses.',
      missingSpace: 'Missing space before function parentheses.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode
    const baseConfig = typeof context.options[0] === 'string' ? context.options[0] : 'always'
    const overrideConfig = typeof context.options[0] === 'object' ? context.options[0] : {}

    /**
     * Determines whether a function has a name.
     * @param node The function node.
     * @returns Whether the function has a name.
     */
    function isNamedFunction(
      node:
        | Tree.ArrowFunctionExpression
        | Tree.FunctionDeclaration
        | Tree.FunctionExpression,
    ) {
      if (node.id)
        return true

      const parent = node.parent

      return parent.type === 'MethodDefinition'
        || (parent.type === 'Property'
          && (
            parent.kind === 'get'
            || parent.kind === 'set'
            || parent.method
          )
        )
    }

    /**
     * Gets the config for a given function
     * @param node The function node
     * @returns "always", "never", or "ignore"
     */
    function getConfigForFunction(node:
      | Tree.ArrowFunctionExpression
      | Tree.FunctionDeclaration
      | Tree.FunctionExpression) {
      if (node.type === 'ArrowFunctionExpression') {
        // Always ignore non-async functions and arrow functions without parens, e.g. async foo => bar
        if (node.async && isOpeningParenToken(sourceCode.getFirstToken(node, { skip: 1 })!))
          return overrideConfig.asyncArrow || baseConfig
      }
      else if (isNamedFunction(node)) {
        return overrideConfig.named || baseConfig

        // `generator-star-spacing` should warn anonymous generators. E.g. `function* () {}`
      }
      else if (!node.generator) {
        return overrideConfig.anonymous || baseConfig
      }

      return 'ignore'
    }

    /**
     * Checks the parens of a function node
     * @param node A function node
     */
    function checkFunction(node:
      | Tree.ArrowFunctionExpression
      | Tree.FunctionDeclaration
      | Tree.FunctionExpression) {
      const functionConfig = getConfigForFunction(node)

      if (functionConfig === 'ignore')
        return

      const rightToken = sourceCode.getFirstToken(node, isOpeningParenToken)!
      const leftToken = sourceCode.getTokenBefore(rightToken)!
      const hasSpacing = sourceCode.isSpaceBetween(leftToken, rightToken)

      if (hasSpacing && functionConfig === 'never') {
        context.report({
          node,
          loc: {
            start: leftToken.loc.end,
            end: rightToken.loc.start,
          },
          messageId: 'unexpectedSpace',
          fix(fixer) {
            const comments = sourceCode.getCommentsBefore(rightToken)

            // Don't fix anything if there's a single line comment between the left and the right token
            if (comments.some(comment => comment.type === 'Line'))
              return null

            return fixer.replaceTextRange(
              [leftToken.range[1], rightToken.range[0]],
              comments.reduce((text, comment) => text + sourceCode.getText(comment), ''),
            )
          },
        })
      }
      else if (!hasSpacing && functionConfig === 'always') {
        context.report({
          node,
          loc: rightToken.loc,
          messageId: 'missingSpace',
          fix: fixer => fixer.insertTextAfter(leftToken, ' '),
        })
      }
    }

    return {
      ArrowFunctionExpression: checkFunction,
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
    }
  },
})
