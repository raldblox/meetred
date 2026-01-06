import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface TrueFocusProps {
  sentence?: string
  manualMode?: boolean
  blurAmount?: number
  borderColor?: string
  glowColor?: string
  animationDuration?: number
  pauseBetweenAnimations?: number
}

interface FocusRect {
  x: number
  y: number
  width: number
  height: number
}

const TrueFocus: React.FC<TrueFocusProps> = ({
  sentence = 'True Focus',
  manualMode = false,
  blurAmount = 5,
  borderColor = 'red',
  glowColor = 'rgba(255, 0, 0, 0.6)',
  animationDuration = 0.5,
  pauseBetweenAnimations = 1,
}) => {
  const words = sentence.split(' ')
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [lastActiveIndex, setLastActiveIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [focusRect, setFocusRect] = useState<FocusRect>({ x: 0, y: 0, width: 0, height: 0 })

  useEffect(() => {
    if (!manualMode) {
      const interval = setInterval(
        () => {
          setCurrentIndex((prev) => (prev + 1) % words.length)
        },
        (animationDuration + pauseBetweenAnimations) * 1000,
      )

      return () => clearInterval(interval)
    }
  }, [manualMode, animationDuration, pauseBetweenAnimations, words.length])

  useEffect(() => {
    if (currentIndex === null || currentIndex === -1) return
    if (!wordRefs.current[currentIndex] || !containerRef.current) return

    const parentRect = containerRef.current.getBoundingClientRect()
    const activeRect = wordRefs.current[currentIndex]!.getBoundingClientRect()

    setFocusRect({
      x: activeRect.left - parentRect.left,
      y: activeRect.top - parentRect.top,
      width: activeRect.width,
      height: activeRect.height,
    })
  }, [currentIndex, words.length])

  const handleMouseEnter = (index: number) => {
    if (manualMode) {
      setLastActiveIndex(index)
      setCurrentIndex(index)
    }
  }

  const handleMouseLeave = () => {
    if (manualMode) {
      setCurrentIndex(lastActiveIndex!)
    }
  }

  return (
    <div ref={containerRef} className="relative flex gap-0 justify-center items-center flex-wrap">
      {words.map((word, index) => {
        const isActive = index === currentIndex

        return (
          <span
            key={index}
            ref={(el) => {
              wordRefs.current[index] = el
            }}
            className={`relative text-xl font-black duration-500 !transition-all text-foreground cursor-pointer ${isActive && 'text-primary/100'}`}
            style={
              {
                filter: manualMode
                  ? isActive
                    ? `blur(0px)`
                    : `blur(${blurAmount}px)`
                  : isActive
                    ? `blur(0px)`
                    : `blur(${blurAmount}px)`,
                transition: `filter ${animationDuration}s ease`,
              } as React.CSSProperties
            }
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
          >
            {word}
          </span>
        )
      })}

      <motion.div
        animate={{
          x: focusRect.x,
          y: focusRect.y,
          width: focusRect.width,
          height: focusRect.height,
          opacity: currentIndex >= 0 ? 1 : 0,
        }}
        className="absolute bg-primary/10 top-0 left-0 pointer-events-none box-border border-0"
        style={
          {
            '--border-color': borderColor,
            '--glow-color': glowColor,
          } as React.CSSProperties
        }
        transition={{
          duration: animationDuration,
        }}
      >
        <span
          className="absolute w-1.5 h-1.5 border-1 top-[-0px] left-[-3px] border-r-0 border-b-0"
          style={{
            borderColor: 'var(--border-color)',
            filter: 'drop-shadow(0 0 2px var(--border-color))',
          }}
        />
        <span
          className="absolute w-1.5 h-1.5 border-1 top-[-1px] right-[-3px] border-l-0 border-b-0"
          style={{
            borderColor: 'var(--border-color)',
            filter: 'drop-shadow(0 0 2px var(--border-color))',
          }}
        />
        <span
          className="absolute w-1.5 h-1.5 border-1 bottom-[-0px] left-[-3px] border-r-0 border-t-0"
          style={{
            borderColor: 'var(--border-color)',
            filter: 'drop-shadow(0 0 2px var(--border-color))',
          }}
        />
        <span
          className="absolute w-1.5 h-1.5 border-1 bottom-[-0px] right-[-3px] border-l-0 border-t-0"
          style={{
            borderColor: 'var(--border-color)',
            filter: 'drop-shadow(0 0 2px var(--border-color))',
          }}
        />
      </motion.div>
    </div>
  )
}

export default TrueFocus
