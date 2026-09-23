import { ref } from 'vue'

const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const isErrorModalOpen = ref(false)
let successTimer: ReturnType<typeof setTimeout>

export function useAppFeedback() {
  const showSuccess = (msg: string) => {
    successMessage.value = msg
    clearTimeout(successTimer)
    successTimer = setTimeout(() => {
      successMessage.value = null
    }, 3000)
  }

  const showErrorModal = (msg: string) => {
    errorMessage.value = msg
    isErrorModalOpen.value = true
  }

  const closeErrorModal = () => {
    isErrorModalOpen.value = false
    setTimeout(() => { errorMessage.value = null }, 300)
  }

  return {
    successMessage,
    errorMessage,
    isErrorModalOpen,
    showSuccess,
    showErrorModal,
    closeErrorModal
  }
}
