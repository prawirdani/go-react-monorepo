import { authMutations, userMutations } from "@repo/queries"
import { authAPI, userAPI } from "./api"

export const { inviteUser, revokeSession, revokeUserSessions } =
  authMutations(authAPI)
export const {
  updateUser,
  deleteUser,
  restoreUser,
  changeProfilePicture,
  deleteProfilePicture,
} = userMutations(userAPI)
