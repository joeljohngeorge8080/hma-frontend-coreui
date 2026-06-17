/**
 * Redux Store Configuration
 *
 * Simple Redux store managing global application state.
 * Handles sidebar visibility and theme preferences.
 *
 * @module store
 */

import { legacy_createStore as createStore } from 'redux'

/**
 * Initial state for the Redux store
 * @type {Object}
 * @property {boolean} sidebarShow - Controls sidebar visibility (true = visible, false = hidden)
 * @property {boolean} sidebarUnfoldable - Controls sidebar narrow/wide mode
 * @property {string} theme - Current theme mode ('light', 'dark', or 'auto')
 * @property {Object|null} user - Authenticated user ({ employee_id, full_name, role })
 * @property {string|null} token - JWT access token
 */
const initialState = {
  sidebarShow: true,
  sidebarUnfoldable: false,
  theme: 'light',
  // TEMP Phase-0 mock so the shell renders before login exists.
  // Replaced with `user: null` + real JWT login in Phase 1.
  user: { employee_id: 'THLL0001', full_name: 'Dev User', role: 'CEO' },
  token: null,
}

/**
 * Root reducer function that handles all state changes
 *
 * @param {Object} state - Current state (defaults to initialState)
 * @param {Object} action - Action object with type and payload
 * @param {string} action.type - Action type ('set' to update state)
 * @param {...*} rest - Additional properties to merge into state
 * @returns {Object} New state object
 *
 * @example
 * // Update sidebar visibility
 * dispatch({ type: 'set', sidebarShow: false })
 *
 * @example
 * // Update theme
 * dispatch({ type: 'set', theme: 'dark' })
 *
 * @example
 * // Update multiple properties
 * dispatch({ type: 'set', sidebarShow: true, theme: 'light' })
 */
const changeState = (state = initialState, { type, ...rest }) => {
  switch (type) {
    case 'set':
      return { ...state, ...rest }
    default:
      return state
  }
}

/**
 * Redux store instance
 * @type {import('redux').Store}
 */
const store = createStore(changeState)
export default store
