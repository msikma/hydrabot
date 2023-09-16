// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import {wrapCodeBlock} from '../util/format.js'
import {getErrorMessage} from '../util/error.js'

/**
 * Sends a reply to an interaction indicating that the command was unknown.
 */
export function sendUnknownCommandReply(interaction, {logger}) {
  logger.logWarn`Interaction yielded unknown command (id={white ${interaction.id}})`
  return interaction.reply({content: `Unknown command: **${interaction.commandName}**.`, ephemeral: true})
}

/**
 * Sends a reply to an interaction indicating that an error occurred.
 */
export function sendErrorReply(interaction, error, {logger}) {
  const errorMessage = getErrorMessage(error)
  logger.logWarn`Interaction error (id={white ${interaction.id}}):`
  logger.log`${errorMessage}`
  return interaction.reply({content: `An error occurred while handling this interaction.\n${wrapCodeBlock(errorMessage)}`, ephemeral: true})
}
