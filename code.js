// src/components/RegistrationForm.js
import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object().shape({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  idNumber: yup.string().optional(), // Optional field
  phoneNumber: yup.string().optional(),
  address: yup.string().optional(),
  dateOfBirth: yup.date().optional(),
  gender: yup.string().optional(),
  maritalStatus: yup.string().optional(),
  employmentStatus: yup.string().optional(),
  employer: yup.string().optional(),
  jobTitle: yup.string().optional(),
  income: yup.number().optional(),
  bankName: yup.string().optional(),
  accountNumber: yup.string().optional(), // VERY SENSITIVE - handle with extreme care!
  branchCode: yup.string().optional(),
  accountType: yup.string().optional(),
  // ... Add other form fields as needed ...
  agreeToTerms: yup.boolean().oneOf([true], 'You must agree to the terms and conditions'),
});

function RegistrationForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data) => {
    try {
      // Send data to the backend API
      const response = await axios.post('/api/register', data);
      console.log(response.data); // Handle success (e.g., redirect to login)
    } catch (error) {
      console.error('Registration error:', error); // Handle error (e.g., display error message)
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Example input field */}
      <div>
        <label htmlFor="firstName">First Name</label>
        <input type="text" id="firstName" {...register('firstName')} />
        {errors.firstName && <p>{errors.firstName.message}</p>}
      </div>
        <div>
        <label htmlFor="lastName">Last Name</label>
        <input type="text" id="lastName" {...register('lastName')} />
        {errors.lastName && <p>{errors.lastName.message}</p>}
      </div>
        <div>
        <label htmlFor="email">Email</label>
        <input type="email" id="email" {...register('email')} />
        {errors.email && <p>{errors.email.message}</p>}
      </div>
        <div>
        <label htmlFor="password">Password</label>
        <input type="password" id="password" {...register('password')} />
        {errors.password && <p>{errors.password.message}</p>}
      </div>
        <div>
        <label htmlFor="idNumber">ID Number (Optional)</label>
        <input type="text" id="idNumber" {...register('idNumber')} />
      </div>
        <div>
        <label htmlFor="phoneNumber">Phone Number (Optional)</label>
        <input type="tel" id="phoneNumber" {...register('phoneNumber')} />
      </div>

      {/* Add all other input fields similarly */}
      <div>
        <label htmlFor="address">Address (Optional)</label>
        <textarea id="address" {...register('address')} />
      </div>
      <div>
        <label htmlFor="bankName">Bank Name (Optional)</label>
        <input type="text" id="bankName" {...register('bankName')} />
      </div>

      {/* ... More form fields ... */}

      <div>
        <input type="checkbox" id="agreeToTerms" {...register('agreeToTerms')} />
        <label htmlFor="agreeToTerms">I agree to the terms and conditions</label>
        {errors.agreeToTerms && <p>{errors.agreeToTerms.message}</p>}
      </div>
      <button type="submit">Register</button>
    </form>
  );
}

export default RegistrationForm;


// src/components/PaymentForm.js (Stripe Example - HIGHLY SIMPLIFIED)
import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

    const handleSubmit = async (event) => {
    event.preventDefault();
    setProcessing(true);
    setError(null);

    if (!stripe || !elements) {
      // Stripe.js hasn't loaded yet.  Make sure to disable
      // form submission until Stripe.js has loaded.
      return;
    }

    const cardElement = elements.getElement(CardElement);

        const { error, paymentMethod } = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
        });

    if (error) {
      console.error('[stripe error]', error);
      setError(error.message);
      setProcessing(false);
    } else {
      console.log('[PaymentMethod]', paymentMethod);
      // Send paymentMethod.id to your server
            try {
                const response = await axios.post('/api/process-payment', {
                    paymentMethodId: paymentMethod.id,
                    amount: 1000, // Example amount (in cents) - get this from your application logic
                    // ... other data (e.g., user ID, report ID) ...
                });
               console.log(response.data); // Handle successful payment
            } catch(err) {
             console.error("Payment processing error:", err);
              setError(err.message || "Payment failed");
             } finally {
          setProcessing(false);
            }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <button type="submit" disabled={!stripe || processing}>
        {processing ? 'Processing...' : 'Pay'}
      </button>
    </form>
  );
}

export default PaymentForm;