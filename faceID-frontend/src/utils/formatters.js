export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
};

export const formatTime = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return `${formatTime(date)} ${formatDate(date)}`;
  } catch (e) {
    return dateString;
  }
};
