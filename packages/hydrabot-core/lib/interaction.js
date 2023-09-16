// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

/**
 * Finds the appropriate command for handling an incoming interaction.
 */
export function findInteractionCommand(interaction, commands) {
  const {commandName} = interaction
  const command = commands.find(cmd => cmd.manifest.name === commandName)
  return command
}

/**
 * Returns metadata for a given message handler.
 */
export function getMessageHandlerMeta(message, dataConfig) {
  const guildId = message.guildId
  const guildConfig = dataConfig.discord.guilds.find(guild => guild.id === guildId)
  return {meta: {guildConfig}}
}

/**
 * Returns metadata for a given interaction.
 */
export function getInteractionMeta(interaction, command, dataConfig) {
  const guildId = interaction.guildId
  const guildConfig = dataConfig.discord.guilds.find(guild => guild.id === guildId)
  return {meta: {guildConfig}, logger: command?.logger}
}
