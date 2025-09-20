"use client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import emailjs from "@emailjs/browser";

const Page = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [value, setValue] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = {
      from_name: name,
      from_email: email,
      from_phone_number: phone,
      feedback_type: value,
      message,
    };

    try {
      const response = await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
        data,
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
      );

      setMessageSent(true);

      // reset form
      setName("");
      setEmail("");
      setPhone("");
      setValue(null);
      setMessage("");
    } catch (error) {
      console.error("Email error:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Feedback Form</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
          />
          <Input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full"
          />
          <Input
            type="text"
            placeholder="Enter your phone no."
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full"
          />
          <Select value={value ?? ""} onValueChange={setValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Suggestion or Bug encountered" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="suggestion">Suggestion</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Enter your suggestion or problem in detail"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full min-h-[120px]"
          />
          <Button type="submit" className="w-full">
            Submit
          </Button>
        </form>
        {messageSent && (
          <p className="mt-4 text-center text-green-600 font-medium">
            ✅ Message sent successfully!
          </p>
        )}
      </div>
    </div>
  );
};

export default Page;