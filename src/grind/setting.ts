export type SettingSource = 'user' | 'log' | 'calibration' | 'none'

export interface SettingTransition {
  setting: number | null
  source: SettingSource
}

/**
 * When the target grind size changes, only a size-specific calibration should be
 * replaced. A value entered by the user or loaded from a brew-log entry is the
 * actual current grinder setting and must be preserved.
 */
export function settingAfterSizeChange(
  currentSetting: number | null,
  source: SettingSource,
  nextCalibrationSetting: number | null,
): SettingTransition {
  if (source === 'user' || source === 'log') {
    return { setting: currentSetting, source }
  }
  if (nextCalibrationSetting !== null) {
    return { setting: nextCalibrationSetting, source: 'calibration' }
  }
  return { setting: null, source: 'none' }
}
