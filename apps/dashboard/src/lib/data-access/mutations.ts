import { userMutations } from "@repo/queries"
import { userAPI } from "./api"

export const {
  updateUser,
  deleteUser,
  changeProfilePicture,
  deleteProfilePicture,
} = userMutations(userAPI)
