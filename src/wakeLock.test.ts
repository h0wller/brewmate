import { describe, expect, it } from 'vitest'
import { needsWakeLock } from './wakeLock'
import { clickableProps, isActivationKey } from './a11y'

describe('needsWakeLock', () => {
  it('держит экран, пока таймер идёт и вкладка видна', () => {
    expect(needsWakeLock('run', 'visible')).toBe(true)
  })

  it('не держит экран на паузе, в простое и после завершения', () => {
    expect(needsWakeLock('pause', 'visible')).toBe(false)
    expect(needsWakeLock('idle', 'visible')).toBe(false)
    expect(needsWakeLock('done', 'visible')).toBe(false)
  })

  it('не просит блокировку в скрытой вкладке', () => {
    expect(needsWakeLock('run', 'hidden')).toBe(false)
  })
})

describe('isActivationKey', () => {
  it('Enter и пробел — нажатие, остальное нет', () => {
    expect(isActivationKey('Enter')).toBe(true)
    expect(isActivationKey(' ')).toBe(true)
    expect(isActivationKey('Tab')).toBe(false)
    expect(isActivationKey('a')).toBe(false)
  })
})

describe('clickableProps', () => {
  const key = (k: string, same = true) => {
    const target = {}
    let prevented = false
    return {
      e: { key: k, target, currentTarget: same ? target : {}, preventDefault: () => { prevented = true } },
      wasPrevented: () => prevented,
    }
  }

  it('делает блок кнопкой, доступной с клавиатуры', () => {
    const p = clickableProps(() => {})
    expect(p.role).toBe('button')
    expect(p.tabIndex).toBe(0)
  })

  it('Enter и пробел вызывают действие', () => {
    let n = 0
    const p = clickableProps(() => { n++ })
    const enter = key('Enter')
    p.onKeyDown(enter.e as any)
    const space = key(' ')
    p.onKeyDown(space.e as any)
    expect(n).toBe(2)
    expect(space.wasPrevented()).toBe(true)
  })

  it('игнорирует другие клавиши и клавиши из вложенных элементов', () => {
    let n = 0
    const p = clickableProps(() => { n++ })
    p.onKeyDown(key('Tab').e as any)
    p.onKeyDown(key('Enter', false).e as any)
    expect(n).toBe(0)
  })
})
