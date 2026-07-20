import FadeIn from '../components/FadeIn'
import AnimatedText from '../components/AnimatedText'
import ContactButton from '../components/ContactButton'

const BASE =
  'https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7'

const ABOUT_TEXT =
  "With more than five years of experience in design, i focus on branding, web design, and user experience, i truly enjoy working with businesses that aim to stand out and present their best image. Let's build something incredible together!"

export default function AboutSection() {
  return (
    <section
      id="about"
      className="relative flex min-h-screen flex-col items-center justify-center px-5 py-20 sm:px-8 md:px-10"
    >
      <FadeIn
        delay={0.1}
        x={-80}
        y={0}
        duration={0.9}
        className="absolute left-[1%] top-[4%] sm:left-[2%] md:left-[4%]"
      >
        <img
          src={`${BASE}/moon_icon.11395d36.png`}
          alt=""
          className="w-[120px] sm:w-[160px] md:w-[210px]"
        />
      </FadeIn>
      <FadeIn
        delay={0.25}
        x={-80}
        y={0}
        duration={0.9}
        className="absolute bottom-[8%] left-[3%] sm:left-[6%] md:left-[10%]"
      >
        <img
          src={`${BASE}/p59_1.4659672e.png`}
          alt=""
          className="w-[100px] sm:w-[140px] md:w-[180px]"
        />
      </FadeIn>
      <FadeIn
        delay={0.15}
        x={80}
        y={0}
        duration={0.9}
        className="absolute right-[1%] top-[4%] sm:right-[2%] md:right-[4%]"
      >
        <img
          src={`${BASE}/lego_icon-1.703bb594.png`}
          alt=""
          className="w-[120px] sm:w-[160px] md:w-[210px]"
        />
      </FadeIn>
      <FadeIn
        delay={0.3}
        x={80}
        y={0}
        duration={0.9}
        className="absolute bottom-[8%] right-[3%] sm:right-[6%] md:right-[10%]"
      >
        <img
          src={`${BASE}/Group_134-1.2e04f3ce.png`}
          alt=""
          className="w-[130px] sm:w-[170px] md:w-[220px]"
        />
      </FadeIn>

      <div className="flex flex-col items-center gap-10 sm:gap-14 md:gap-16">
        <FadeIn delay={0} y={40}>
          <h2
            className="hero-heading text-center font-black uppercase leading-none tracking-tight"
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
          >
            About me
          </h2>
        </FadeIn>

        <AnimatedText
          text={ABOUT_TEXT}
          className="max-w-[560px] text-center font-medium leading-relaxed text-[#D7E2EA]"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
        />
      </div>

      <div className="mt-16 sm:mt-20 md:mt-24">
        <FadeIn delay={0.1} y={20}>
          <ContactButton />
        </FadeIn>
      </div>
    </section>
  )
}
