import React from 'react';
import imgDollar from "../assets/dollar.svg";
import imgCheckmark from "../assets/check.svg";
import imgZap from "../assets/zap.svg";

const InformationBlurb = () => {
  const features = [
    {
      icon: imgDollar,
      title: "Cost Effective Options",
      description: "Reduce costs to less than a penny per page"
    },
    {
      icon: imgCheckmark,
      title: "WCAG 2.1 Level AA Standard",
      description: "Meets international accessibility standards"
    },
    {
      icon: imgZap,
      title: "Fast Processing",
      description: "Get automated PDF remediation in minutes"
    }
  ];

  const informationBlurbStyle = {
    display: 'flex',
    gap: '64px',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0'
  };

  const featureCardStyle = {
    width: '280px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    borderTop: '2px solid #8c1d40',
    position: 'relative'
  };

  const iconContainerStyle = {
    backgroundColor: '#ffc627',
    padding: '8px',
    borderRadius: '8px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const iconStyle = {
    width: '32px',
    height: '32px'
  };

  const featureContentStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    textAlign: 'center',
    width: '100%'
  };

  const featureTitleStyle = {
    fontFamily: "'Geist', sans-serif",
    fontWeight: '600',
    fontSize: '14px',
    lineHeight: '20px',
    color: '#020617',
    margin: '0'
  };

  const featureDescriptionStyle = {
    fontFamily: "'Geist', sans-serif",
    fontWeight: '400',
    fontSize: '14px',
    lineHeight: '20px',
    color: '#1e293b',
    margin: '0'
  };

  return (
    <div style={informationBlurbStyle}>
      {features.map((feature, index) => (
        <div key={index} style={featureCardStyle}>
          <div style={iconContainerStyle}>
            <img src={feature.icon} alt="" style={iconStyle} />
          </div>
          <div style={featureContentStyle}>
            <h3 style={featureTitleStyle}>{feature.title}</h3>
            <p style={featureDescriptionStyle}>{feature.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InformationBlurb;
