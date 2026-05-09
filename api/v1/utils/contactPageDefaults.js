const DEFAULT_CONTACT_PAGE_CONTENT = {
  seo: {
    title: 'Liên hệ',
    description:
      'Liên hệ SmartMall qua Zalo, Facebook hoặc email. Hỗ trợ nhanh chóng, tư vấn tận tâm trong giờ hành chính và cả ngoài giờ.'
  },
  links: {
    zaloUrl: 'https://zalo.me/0823387108',
    emailUrl: 'mailto:smartmallhq@gmail.com',
    productsUrl: '/products'
  },
  hero: {
    eyebrow: 'Liên hệ hỗ trợ',
    titleLine1: 'Cần hỗ trợ?',
    titleLine2: 'Bên mình luôn sẵn sàng.',
    description:
      'Gửi tin nhắn cho SmartMall khi bạn cần tư vấn sản phẩm, hỗ trợ đơn hàng hoặc muốn kiểm tra thông tin trước khi mua.',
    zaloButton: 'Nhắn Zalo',
    emailButton: 'Gửi email',
    imageUrl: '/images/herosection-aboutpage.jpg',
    imageAlt: 'SmartMall hỗ trợ khách hàng',
    topics: ['Tư vấn sản phẩm', 'Hỗ trợ đơn hàng', 'Phản hồi nhanh'],
    visual: {
      badge: 'Hỗ trợ 1:1 từ SmartMall',
      eyebrow: 'Phản hồi minh bạch',
      description: 'Tư vấn rõ ràng, kiểm tra nhanh và hỗ trợ bạn trước khi mua.',
      button: 'Liên hệ ngay'
    }
  },
  highlightsSection: {
    eyebrow: 'Điểm nổi bật',
    title: 'Lý do khách hàng chọn liên hệ trực tiếp',
    description:
      'Những cam kết hỗ trợ cốt lõi giúp việc tư vấn, xử lý đơn hàng và phản hồi thông tin diễn ra nhanh và rõ ràng hơn.',
    items: [
      { value: '< 3h', label: 'Thời gian phản hồi' },
      { value: '100%', label: 'Bảo mật thông tin' },
      { value: '24/7', label: 'Hỗ trợ tận tâm' }
    ]
  },
  contactMethodsSection: {
    eyebrow: 'Kết nối trực tiếp',
    title: 'Liên hệ với SmartMall',
    description:
      'Chọn kênh phù hợp để được tư vấn sản phẩm, hỗ trợ đơn hàng hoặc giải đáp thông tin trước khi mua.',
    note: 'Ưu tiên liên hệ qua Zalo hoặc Facebook để được phản hồi nhanh hơn.',
    sellers: [
      {
        name: 'Smartmall Gdv 1',
        role: 'Chuyên phần mềm bản quyền',
        avatar: '/images/avt.jpg',
        methods: [
          {
            type: 'zalo',
            title: 'Zalo',
            value: '0823387108',
            actionLabel: 'Nhắn Zalo',
            link: 'https://zalo.me/0823387108'
          },
          {
            type: 'facebook',
            title: 'Facebook',
            value: 'fb.com/lunashop.business.official',
            actionLabel: 'Chat FB',
            link: 'https://www.facebook.com/lunashop.business.official'
          },
          {
            type: 'email',
            title: 'Email',
            value: 'smartmall.business.official@gmail.com',
            actionLabel: 'Gửi email',
            link: 'mailto:smartmall.business.official@gmail.com'
          }
        ]
      },
      {
        name: 'Smartmall Gdv 2',
        role: 'Chuyên tư vấn & hỗ trợ đơn hàng',
        avatar: '/images/avt.jpg',
        methods: [
          {
            type: 'zalo',
            title: 'Zalo',
            value: '0822516521',
            actionLabel: 'Nhắn Zalo',
            link: 'https://zalo.me/0822516521'
          },
          {
            type: 'facebook',
            title: 'Facebook',
            value: 'fb.com/smartmall.world',
            actionLabel: 'Chat FB',
            link: 'https://www.facebook.com/smartmall.world'
          },
          {
            type: 'email',
            title: 'Email',
            value: 'smartmallhq@gmail.com',
            actionLabel: 'Gửi email',
            link: 'mailto:smartmallhq@gmail.com'
          }
        ]
      }
    ]
  },
  formScheduleSection: {
    eyebrow: 'Gửi yêu cầu',
    title: 'Gửi thông tin nhanh, nhận hỗ trợ đúng lúc',
    description:
      'Bạn có thể gửi yêu cầu trực tiếp qua biểu mẫu hoặc xem khung giờ hoạt động để nhận phản hồi nhanh hơn.'
  },
  workingHoursCard: {
    title: 'Thời gian hoạt động',
    description: 'Khung giờ hỗ trợ và phản hồi khách hàng.',
    noteTitle: 'Lưu ý phản hồi',
    noteDescription:
      'Ngoài giờ hành chính, bên mình vẫn kiểm tra tin nhắn định kỳ và ưu tiên phản hồi các yêu cầu khẩn.',
    zaloButton: 'Nhắn Zalo',
    emailButton: 'Gửi email',
    items: [
      { type: 'weekday', day: 'Thứ 2 - Thứ 6', time: '8:00 - 21:00' },
      { type: 'saturday', day: 'Thứ 7', time: '9:00 - 21:00' },
      { type: 'sunday', day: 'Chủ nhật', time: '10:00 - 21:00' }
    ]
  },
  faqSection: {
    eyebrow: 'Câu hỏi thường gặp',
    title: 'Trung tâm trợ giúp',
    description:
      'Một số thắc mắc phổ biến đã được tổng hợp sẵn để bạn tra cứu nhanh trước khi liên hệ trực tiếp.',
    items: [
      {
        question: 'Làm sao để đặt hàng?',
        answer:
          'Bạn có thể liên hệ qua Facebook, Zalo hoặc email. Bên mình sẽ tư vấn và hướng dẫn chi tiết.'
      },
      {
        question: 'Thanh toán như thế nào?',
        answer: 'Bên mình hỗ trợ thanh toán qua ngân hàng và một số ví điện tử phổ biến.'
      },
      {
        question: 'Bao lâu nhận được hàng?',
        answer:
          'Thông thường trong ngày, tối đa 24 giờ. Với tài khoản phần mềm, thời gian xử lý thường nhanh hơn.'
      },
      {
        question: 'Có bảo hành không?',
        answer:
          'Tùy từng sản phẩm sẽ có hoặc không có bảo hành. Nếu có, thông tin thời gian và điều kiện bảo hành sẽ được ghi rõ ở phần mô tả sản phẩm.'
      }
    ]
  },
  faqHelpCard: {
    eyebrow: 'Cần hỗ trợ thêm?',
    title: 'Vẫn chưa thấy câu trả lời?',
    description:
      'Gửi thông tin cho chúng tôi qua Zalo hoặc email, đội ngũ hỗ trợ sẽ phản hồi trong thời gian sớm nhất.',
    zaloButton: 'Chat qua Zalo',
    emailButton: 'Gửi email',
    tip: 'Mẹo: Hãy mô tả rõ nhu cầu và mã đơn nếu có để được hỗ trợ nhanh hơn.'
  },
  ctaSection: {
    eyebrow: 'Cần hỗ trợ thêm?',
    title: 'Bạn chưa tìm được thông tin cần thiết?',
    description:
      'Cứ nhắn mình nếu bạn chưa biết chọn gì, mình sẽ cố gắng tư vấn nhanh để bạn tìm được sản phẩm phù hợp.',
    chatButton: 'Chat ngay với tư vấn viên',
    productsButton: 'Xem sản phẩm nổi bật'
  }
}

const DEFAULT_CONTACT_PAGE_TRANSLATIONS = {
  en: {
    seo: {
      title: 'Contact',
      description:
        'Contact SmartMall via Zalo, Facebook, or email. Fast support and dedicated advice during business hours and beyond.'
    },
    hero: {
      eyebrow: 'Contact support',
      titleLine1: 'Need help?',
      titleLine2: 'We are always ready.',
      description:
        'Message SmartMall when you need product advice, order support, or want to check information before buying.',
      zaloButton: 'Message on Zalo',
      emailButton: 'Send email',
      imageAlt: 'SmartMall customer support',
      topics: ['Product advice', 'Order support', 'Quick response'],
      visual: {
        badge: '1:1 support from SmartMall',
        eyebrow: 'Transparent response',
        description: 'Clear consultation, quick checks, and support before you buy.',
        button: 'Contact now'
      }
    },
    highlightsSection: {
      eyebrow: 'Highlights',
      title: 'Why customers choose to contact us directly',
      description:
        'Core support commitments that make consultation, order handling, and information responses faster and clearer.',
      items: [
        { label: 'Response time' },
        { label: 'Information security' },
        { label: 'Dedicated support' }
      ]
    },
    contactMethodsSection: {
      eyebrow: 'Direct connection',
      title: 'Contact SmartMall',
      description:
        'Choose the right channel for product consultation, order support, or questions before buying.',
      note: 'Prefer contacting us through Zalo or Facebook for a faster response.',
      sellers: [
        {
          role: 'Licensed software specialist',
          methods: [
            { actionLabel: 'Message on Zalo' },
            { actionLabel: 'Chat on Facebook' },
            { actionLabel: 'Send email' }
          ]
        },
        {
          role: 'Order consultation & support',
          methods: [
            { actionLabel: 'Message on Zalo' },
            { actionLabel: 'Chat on Facebook' },
            { actionLabel: 'Send email' }
          ]
        }
      ]
    },
    formScheduleSection: {
      eyebrow: 'Send a request',
      title: 'Send information quickly and get support at the right time',
      description:
        'You can send a request directly through the form or check our working hours to receive a faster response.'
    },
    workingHoursCard: {
      title: 'Working hours',
      description: 'Support and customer response hours.',
      noteTitle: 'Response note',
      noteDescription:
        'Outside business hours, we still check messages periodically and prioritize urgent requests.',
      zaloButton: 'Message on Zalo',
      emailButton: 'Send email',
      items: [
        { day: 'Monday - Friday' },
        { day: 'Saturday' },
        { day: 'Sunday' }
      ]
    },
    faqSection: {
      eyebrow: 'Frequently asked questions',
      title: 'Help center',
      description:
        'Some common questions have been collected so you can quickly check them before contacting us directly.',
      items: [
        {
          question: 'How can I place an order?',
          answer:
            'You can contact us through Facebook, Zalo, or email. We will provide consultation and detailed guidance.'
        },
        {
          question: 'How do I pay?',
          answer: 'We support bank transfer and several popular e-wallets.'
        },
        {
          question: 'How long does delivery take?',
          answer:
            'Usually within the same day, up to 24 hours. For software accounts, processing is often faster.'
        },
        {
          question: 'Is there a warranty?',
          answer:
            'Warranty availability depends on each product. If available, the warranty period and conditions will be clearly stated in the product description.'
        }
      ]
    },
    faqHelpCard: {
      eyebrow: 'Need more help?',
      title: 'Still have not found the answer?',
      description:
        'Send us your information through Zalo or email, and our support team will reply as soon as possible.',
      zaloButton: 'Chat via Zalo',
      emailButton: 'Send email',
      tip: 'Tip: Describe your needs clearly and include your order code, if available, for faster support.'
    },
    ctaSection: {
      eyebrow: 'Need more help?',
      title: 'Have not found the information you need?',
      description:
        'Message me if you are not sure what to choose. I will try to give quick advice so you can find the right product.',
      chatButton: 'Chat with an advisor',
      productsButton: 'View featured products'
    }
  }
}

module.exports = {
  DEFAULT_CONTACT_PAGE_CONTENT,
  DEFAULT_CONTACT_PAGE_TRANSLATIONS
}









