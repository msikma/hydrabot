// HydraBot <https://github.com/msikma/hydrabot>
// © MIT license

import compact from 'lodash.compact'

/**
 * Returns the streaming status for a number of user objects.
 * 
 * A user object must contain a 'username' and 'twitchUsername'.
 */
export async function getCurrentStreamingStatus(users, {twitchApiClient}) {
  const statuses = await Promise.all(users.map(async user => {
    const res = await twitchApiClient.streams.getStreamByUserName(user.twitchUsername)
    return [user.username, {
      user,
      stream: !res ? null : {
        gameName: res.gameName,
        id: res.id,
        startDate: res.startDate,
        tags: res.tags,
        thumbnailUrl: res.thumbnailUrl,
        title: res.title,
        type: res.type,
        userDisplayName: res.userDisplayName,
        userId: res.userId,
        userName: res.userName,
        viewers: res.viewers
      }
    }]
  }))
  return Object.fromEntries(compact(statuses))
}
