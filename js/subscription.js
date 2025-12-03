/**
 * Subscription Form Handler
 * 
 * Handles form submission to Google Forms with automatic
 * collection of browser, device, and location data.
 */

// Google Form Configuration
const GOOGLE_FORM_CONFIG = {
  url: 'https://docs.google.com/forms/d/e/1FAIpQLSd7Rn_UfGTsGdTNvLpMAZMH_cNqPFaQtnHOmadRP0h7KYlnyA/formResponse',
  fields: {
    name: 'entry.1776671031',
    email: 'entry.556623961',
    location: 'entry.1358020764',
    browser: 'entry.1026458690',
    device: 'entry.709745366'
  }
};

/**
 * Get browser user agent string
 */
function getBrowserInfo() {
  return navigator.userAgent;
}

/**
 * Extract device/OS information from user agent
 */
function getDeviceInfo() {
  const ua = navigator.userAgent;
  const osMatch = ua.match(/\(([^)]+)\)/);
  return osMatch ? osMatch[1] : 'Unknown';
}

/**
 * Fetch user's approximate location using IP geolocation
 */
async function getLocationInfo() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    const location = [data?.city, data?.country_name].filter(Boolean).join(', ');
    return location || 'Unknown';
  } catch (error) {
    console.warn('Could not fetch location:', error);
    return 'Unknown';
  }
}

/**
 * Populate hidden fields with derived data
 */
async function populateDerivedFields() {
  document.getElementById('browser').value = getBrowserInfo();
  document.getElementById('device').value = getDeviceInfo();
  
  const location = await getLocationInfo();
  document.getElementById('location').value = location;
}

/**
 * Submit form data to Google Forms
 */
async function submitToGoogleForm(formData) {
  const fd = new FormData();
  fd.append(GOOGLE_FORM_CONFIG.fields.name, formData.fullName);
  fd.append(GOOGLE_FORM_CONFIG.fields.email, formData.email);
  fd.append(GOOGLE_FORM_CONFIG.fields.location, formData.location);
  fd.append(GOOGLE_FORM_CONFIG.fields.browser, formData.browser);
  fd.append(GOOGLE_FORM_CONFIG.fields.device, formData.device);

  await fetch(GOOGLE_FORM_CONFIG.url, {
    method: 'POST',
    mode: 'no-cors', // Required for Google Forms
    body: fd
  });
}

/**
 * Show loading state on submit button
 */
function setLoadingState(isLoading) {
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');

  submitBtn.disabled = isLoading;
  
  if (isLoading) {
    btnText.classList.add('d-none');
    btnSpinner.classList.remove('d-none');
  } else {
    btnText.classList.remove('d-none');
    btnSpinner.classList.add('d-none');
  }
}

/**
 * Show success message and hide form
 */
function showSuccessMessage() {
  const formSection = document.getElementById('formSection');
  const successSection = document.getElementById('successSection');
  
  formSection.style.display = 'none';
  successSection.classList.add('show');
}

/**
 * Dispatch custom events for tracking/analytics
 */
function dispatchCustomEvents(payload, eventType = 'success') {
  if (eventType === 'success') {
    window.dispatchEvent(new CustomEvent('request-access-submitted', { detail: payload }));
    window.dispatchEvent(new CustomEvent('request-access-success', { detail: payload }));
  } else if (eventType === 'error') {
    window.dispatchEvent(new CustomEvent('request-access-error', { detail: payload }));
  }
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  // Collect form data
  const formData = {
    fullName: document.getElementById('fullName').value,
    email: document.getElementById('email').value,
    location: document.getElementById('location').value,
    browser: document.getElementById('browser').value,
    device: document.getElementById('device').value
  };

  setLoadingState(true);

  try {
    await submitToGoogleForm(formData);
    showSuccessMessage();
    dispatchCustomEvents(formData, 'success');
  } catch (error) {
    alert('Something went wrong. Please try again.');
    dispatchCustomEvents({ error: String(error) }, 'error');
    setLoadingState(false);
  }
}

/**
 * Initialize the subscription form
 */
function initSubscriptionForm() {
  // Populate derived fields
  populateDerivedFields();
  
  // Focus on first field
  document.getElementById('fullName').focus();
  
  // Attach form submit handler
  const form = document.getElementById('subscriptionForm');
  form.addEventListener('submit', handleFormSubmit);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSubscriptionForm);
} else {
  initSubscriptionForm();
}
